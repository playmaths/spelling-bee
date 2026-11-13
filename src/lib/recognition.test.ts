import { describe, expect, it } from 'vitest'
import { PATTERNS, WORDS, getWord } from '../data/index.ts'
import { recognitionCheckFor } from './recognition.ts'

describe('recognitionCheckFor', () => {
  it('asks for the secret of the word she just spelled, in plain words', () => {
    const check = recognitionCheckFor(getWord('word_practice')!)
    expect(check.question).toBe('What is the secret of PRACTICE?')
    expect(check.correctAnswer).toContain('I-C-E')
  })

  it.each(PATTERNS.map((p) => [p.patternId, p] as const))('%s has a short secret with no sound symbols', (_, p) => {
    expect(p.secret).toBeTruthy()
    expect(p.secret).not.toMatch(/[ɪəɛæɒʌʃʒθŋ]|syllable/i)
    expect(p.secret!.length).toBeLessThanOrEqual(160)
  })

  it.each(WORDS.map((w) => [w.word, w] as const))('%s gets three distinct options with one right answer', (_, w) => {
    const check = recognitionCheckFor(w)
    expect(new Set(check.options).size).toBe(3)
    expect(check.options.filter((o) => o === check.correctAnswer)).toHaveLength(1)
  })
})
