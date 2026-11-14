import { describe, expect, it } from 'vitest'
import { classifyAttempt } from '../engine/diagnosticClassifier.ts'
import { CARDS, PATTERNS, RHYMES, WORDS, getCard, getPattern, getSoundCue, getWord } from './index.ts'

const wholeWord = (w: string) => new RegExp(`\\b${w}\\b`, 'i')

describe('word bank integrity', () => {
  it('defines every word referenced by patterns.json, with the matching role and pattern', () => {
    for (const p of PATTERNS) {
      const expected = [
        ...p.anchorWordIds.map((id) => [id, 'ANCHOR'] as const),
        ...p.guidedWordIds.map((id) => [id, 'GUIDED'] as const),
        ...p.transferProbeIds.map((id) => [id, 'TRANSFER_PROBE'] as const),
      ]
      for (const [id, role] of expected) {
        expect(getWord(id), id).toMatchObject({ role, patternId: p.patternId })
      }
    }
    const referenced = PATTERNS.flatMap((p) => [...p.anchorWordIds, ...p.guidedWordIds, ...p.transferProbeIds])
    expect(WORDS.map((w) => w.id).sort()).toEqual([...referenced].sort())
  })

  it.each(WORDS.map((w) => [w.word, w] as const))('%s is internally consistent', (_, w) => {
    expect(w.id).toBe(`word_${w.word}`)
    expect(w.word).toMatch(/^[a-z]+$/)
    expect(w.syllables.join('')).toBe(w.word)
    expect(w.difficulty).toBeGreaterThanOrEqual(1.5)
    expect(w.difficulty).toBeLessThanOrEqual(4.5)

    // Grapheme chunks tile the word exactly, and one of them is the pattern focus.
    expect(w.graphemeMap.map((c) => c.grapheme).join('')).toBe(w.word)
    let cursor = 0
    for (const c of w.graphemeMap) {
      expect(c.startIndex).toBe(cursor)
      expect(c.endIndex).toBe(cursor + c.grapheme.length - 1)
      cursor = c.endIndex + 1
    }
    expect(w.graphemeMap.some((c) => c.isPatternFocus)).toBe(true)

    // The Judge speaks the word in the sentence; the screen never shows it.
    expect(w.meanings.length).toBeGreaterThan(0)
    for (const m of w.meanings) {
      expect(m.exampleSentence).toMatch(wholeWord(w.word))
      expect(m.blankedSentence).not.toMatch(wholeWord(w.word))
      expect(m.blankedSentence).toBe(m.exampleSentence.replace(wholeWord(w.word), '_'.repeat(w.word.length)))
      expect(m.exampleSentence.match(new RegExp(`\\b${w.word}\\b`, 'gi'))).toHaveLength(1)
      expect(m.kidDefinition).not.toMatch(wholeWord(w.word))
    }

    // Traps point at the first tile that differs and are picked up by the classifier.
    expect(w.traps.length).toBeGreaterThan(0)
    for (const t of w.traps) {
      // A trap that only adds letters on the end points at the last tile.
      const diff = [...w.word].findIndex((ch, i) => t.misspelling[i] !== ch)
      const first = diff < 0 ? w.word.length - 1 : diff
      expect(t.errorTileIndex, t.misspelling).toBe(first)
      expect(classifyAttempt(w, t.misspelling).bucket).toBe(t.bucket)
      if (t.candidatePair) expect(t.candidatePair).toContain(w.word[first].toUpperCase())
      expect(t.misspelling).not.toBe(w.word)
      expect(WORDS.some((o) => o.word === t.misspelling && o.patternId === w.patternId), `${t.misspelling} is a real word in this family`).toBe(false)
    }
  })
})

describe('transfer quarantine (data level)', () => {
  // A probe must not be shown or named while its own family is being taught.
  // (Across families a word may turn up in a sentence, as it would in any book.)
  it.each(PATTERNS.map((p) => [p.patternId, p] as const))('%s never pre-teaches its own probes', (_, p) => {
    const probes = p.transferProbeIds.map((id) => getWord(id)!.word)
    // badgeName is excluded: badges stay hidden until earned.
    const texts = [JSON.stringify([p.title, p.kidRule, p.recognitionCheck])]
    for (const id of [...p.anchorWordIds, ...p.guidedWordIds]) {
      const w = getWord(id)!
      const card = getCard(id)!
      // Only the written text counts (a flag like isPatternFocus: true is not the word "true").
      const hints = w.graphemeMap.map((c) => c.coachingHint ?? '')
      texts.push(JSON.stringify([w.meanings, hints, w.traps, w.wordStory, card.sentence, card.synonyms, card.hook]))
    }
    for (const probe of probes) {
      for (const text of texts) expect(text, `${p.patternId} leaks ${probe}`).not.toMatch(wholeWord(probe))
    }
  })

  it('has no duplicate words or families', () => {
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length)
    expect(new Set(PATTERNS.map((p) => p.patternId)).size).toBe(PATTERNS.length)
  })

  it.each(PATTERNS.map((p) => [p.patternId, p] as const))('%s is a complete family', (_, p) => {
    expect(p.kind).toBeTruthy()
    expect(p.anchorWordIds.length).toBeGreaterThanOrEqual(1)
    expect(p.anchorWordIds.length + p.guidedWordIds.length).toBeGreaterThanOrEqual(2)
    expect(p.transferProbeIds.length).toBeGreaterThanOrEqual(3)
    expect(p.recognitionCheck.distractors).toHaveLength(2)
  })
})

describe('word cards', () => {
  it('has exactly one card per word', () => {
    expect(CARDS.map((c) => c.wordId).sort()).toEqual(WORDS.map((w) => w.id).sort())
  })

  it.each(CARDS.map((c) => [c.wordId, c] as const))('%s card is well formed', (_, c) => {
    const w = getWord(c.wordId)!
    expect(w.word).toContain(c.hook)
    expect(c.hook).not.toBe(w.word)
    expect(c.sentence.toLowerCase()).toContain(`*${w.word}*`)
    expect(c.sentence.toLowerCase()).toContain(c.hook)
    expect(c.synonyms.length).toBeGreaterThan(0)
    expect(c.emoji).not.toBe('')
  })
})

describe('sound cues', () => {
  it('has an entry (a cue, or a deliberate blank) for every word and nothing else', () => {
    expect(Object.keys(RHYMES).sort()).toEqual(WORDS.map((w) => w.word).sort())
    const blanks = WORDS.filter((w) => getSoundCue(w.word) === null).length
    expect(blanks).toBeLessThan(WORDS.length * 0.05)
  })

  it.each(WORDS.map((w) => [w.word, w] as const))('%s: the cue is a different, plain word and never a held-back word of its family', (_, w) => {
    const cue = getSoundCue(w.word)
    if (!cue) return
    const other = 'rhyme' in cue ? cue.rhyme : cue.endsLike
    expect(other).toMatch(/^[a-z]+$/)
    expect(other).not.toBe(w.word)
    if (w.role !== 'TRANSFER_PROBE') {
      const probes = getPattern(w.patternId)!.transferProbeIds.map((id) => getWord(id)!.word)
      expect(probes).not.toContain(other)
    }
  })
})

