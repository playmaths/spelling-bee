#!/usr/bin/env node
// Lists every recording the app can play: node scripts/audio-manifest.mjs > audio-manifest.json
// Keys must match src/lib/clips.ts. Order = priority (the word itself first).
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const data = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/data')
const read = (f) => JSON.parse(readFileSync(join(data, f), 'utf8'))

const words = [] // { word, meanings: [{pos, def, sent}], card }
const legacyCards = new Map(read('cards.json').map((c) => [c.wordId, c.sentence]))
for (const w of read('words.json')) {
  words.push({
    word: w.word,
    meanings: w.meanings.map((m) => ({ pos: m.partOfSpeech, def: m.kidDefinition, sent: m.exampleSentence })),
    card: legacyCards.get(w.id),
  })
}
for (const f of readdirSync(join(data, 'families')).filter((f) => f.endsWith('.json')).sort()) {
  for (const w of read(join('families', f)).words) {
    words.push({ word: w.w, meanings: [{ pos: w.pos, def: w.def, sent: w.sent }], card: w.card })
  }
}

const plain = (s) => s.replace(/\*/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
const article = (pos) => (/^[aeiou]/.test(pos) ? 'an' : 'a')
const tiers = [[], [], [], []]
for (const w of words) {
  tiers[0].push({ key: `w/${w.word}`, text: w.word, speed: 0.9 })
  tiers[0].push({ key: `s/${w.word}`, text: w.word, speed: 0.55 })
  w.meanings.forEach((m, i) => {
    tiers[1].push({ key: `x/${w.word}-${i}`, text: plain(m.sent), speed: 0.9 })
    tiers[2].push({ key: `d/${w.word}-${i}`, text: `It's ${article(m.pos)} ${m.pos}. ${plain(m.def)}`, speed: 0.9 })
  })
  tiers[2].push({ key: `q/${w.word}`, text: `What is the secret of ${w.word}?`, speed: 0.9 })
  if (w.card) tiers[3].push({ key: `c/${w.word}`, text: plain(w.card), speed: 0.9 })
}
const fixed = [
  ['p/great-detective', 'Great detective work!'],
  ['p/not-quite', 'Not quite. Try another one.'],
].map(([key, text]) => ({ key, text, speed: 0.9 }))

process.stdout.write(JSON.stringify({ voice: 'af_heart', clips: [...fixed, ...tiers.flat()] }))
