#!/usr/bin/env node
// Checks compact family files: node scripts/check-family.mjs src/data/families/<id>.json [...]
import { readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const famDir = join(root, 'src/data/families')
const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/check-family.mjs <family.json> [...]')
  process.exit(2)
}

// Words already taken elsewhere (legacy bank + other family files).
const taken = new Map()
for (const w of JSON.parse(readFileSync(join(root, 'src/data/words.json'), 'utf8'))) taken.set(w.word, 'words.json')
for (const f of readdirSync(famDir).filter((f) => f.endsWith('.json'))) {
  if (files.some((x) => basename(x) === f)) continue
  try {
    for (const w of JSON.parse(readFileSync(join(famDir, f), 'utf8')).words) taken.set(w.w, f)
  } catch {
    /* another author's file may be mid-write */
  }
}

const whole = (w) => new RegExp(`\\b${w}\\b`, 'i')
let failed = false
for (const file of files) {
  const errs = []
  const err = (m) => errs.push(m)
  let fam
  try {
    fam = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.log(`✗ ${file}: invalid JSON: ${e.message}`)
    failed = true
    continue
  }
  if (basename(file) !== `${fam.patternId}.json`) err(`file name must be ${fam.patternId}.json`)
  for (const k of ['patternId', 'kind', 'title', 'emoji', 'kidRule', 'hint', 'reminder']) if (!fam[k]) err(`missing ${k}`)
  if (!fam.check?.question || !fam.check?.correctAnswer || fam.check?.distractors?.length !== 2) err('check needs question, correctAnswer and exactly 2 distractors')
  const words = fam.words ?? []
  const count = (r) => words.filter((w) => w.role === r).length
  if (words.length !== 10) err(`needs exactly 10 words, has ${words.length}`)
  if (count('A') !== 2 || count('G') !== 4 || count('P') !== 4) err(`roles must be 2 A, 4 G, 4 P (has ${count('A')}/${count('G')}/${count('P')})`)
  const probes = words.filter((w) => w.role === 'P').map((w) => w.w)
  const anchors = words.filter((w) => w.role === 'A').map((w) => w.w)
  if (fam.check?.question && !anchors.some((a) => whole(a).test(fam.check.question))) err('check.question must name one of the anchor words')
  for (const p of probes) {
    if (whole(p).test(JSON.stringify([fam.title, fam.kidRule, fam.hint, fam.reminder, fam.check]))) err(`family text names probe "${p}"`)
  }
  const seen = new Set()
  for (const w of words) {
    const e = (m) => err(`${w.w}: ${m}`)
    if (!/^[a-z]+$/.test(w.w ?? '')) { e('word must be lowercase letters only'); continue }
    if (seen.has(w.w)) e('duplicate in this file')
    seen.add(w.w)
    if (taken.has(w.w)) e(`already used in ${taken.get(w.w)}`)
    if ((w.syl ?? '').split('-').join('') !== w.w) e(`syl "${w.syl}" does not join to the word`)
    if (!w.say) e('missing say')
    if (!(w.d >= 2.2 && w.d <= 4.5)) e(`d is ${w.d}: every word must be 2.2-4.5 (the learner's level starts at 2.2)`)
    if (!['noun', 'verb', 'adjective', 'adverb'].includes(w.pos)) e('bad pos')
    const at = w.focusAt ?? w.w.indexOf(w.focus)
    if (!w.focus || at < 0 || w.w.slice(at, at + w.focus.length) !== w.focus) e(`focus "${w.focus}" not found in word`)
    if (!w.def || whole(w.w).test(w.def)) e('def missing or contains the word')
    const hits = (w.sent ?? '').match(new RegExp(`\\b${w.w}\\b`, 'gi')) ?? []
    if (hits.length !== 1) e(`sent must contain the exact word once (found ${hits.length})`)
    if (!Array.isArray(w.traps) || w.traps.length < 1) e('needs at least one trap')
    for (const t of w.traps ?? []) {
      if (!/^[a-z]+$/.test(t)) e(`trap "${t}" must be lowercase letters`)
      if (t === w.w) e('trap equals the word')
      if (seen.has(t) || words.some((o) => o.w === t)) e(`trap "${t}" is another word in this family`)
    }
    const t0 = w.traps?.[0] ?? ''
    const diffs = [...w.w].filter((ch, i) => t0[i] !== ch).length
    const singleSwap = t0.length === w.w.length && diffs === 1
    let first = 0
    while (first < w.w.length && w.w[first] === t0[first]) first++
    const silentDrop =
      t0 === w.w.slice(0, first) + w.w.slice(first + 1) &&
      first >= at && first < at + w.focus.length &&
      w.w[first + 1] !== w.w[first] && w.w[first - 1] !== w.w[first]
    if (!singleSwap && !silentDrop) e(`first trap "${t0}" must swap exactly ONE letter (same length), or drop one silent letter inside the focus`)
    if (!w.story) e('missing story')
    if (!w.emoji) e('missing emoji')
    if (!w.hook || w.hook === w.w || !w.w.includes(w.hook)) e(`hook "${w.hook}" must be a smaller piece of the word`)
    if (!Array.isArray(w.syn) || w.syn.length < 1) e('needs a synonym')
    if (!(w.card ?? '').toLowerCase().includes(`*${w.w}*`)) e('card must contain *word* in asterisks')
    if (!(w.card ?? '').toLowerCase().replace(/\*/g, '').includes(w.hook)) e('card must contain the hook letters')
    if (w.role !== 'P') {
      const text = JSON.stringify([w.def, w.sent, w.story, w.card, w.syn, w.hook, w.traps, w.trick ?? ''])
      for (const p of probes) if (whole(p).test(text)) e(`names probe "${p}" (probes must stay unseen while the family is taught)`)
    }
  }
  if (errs.length) {
    failed = true
    console.log(`✗ ${file}\n  - ${errs.join('\n  - ')}`)
  } else console.log(`✓ ${file} (${words.length} words)`)
}
process.exit(failed ? 1 : 0)
