import { describe, expect, it } from 'vitest'
import { getWord } from '../data/index.ts'
import type { BeeWord } from '../types/game.ts'
import { classifyAttempt, needsCoaching, type PatternOpportunity } from './diagnosticClassifier.ts'

const word = (id: string) => getWord(id)!

/** Minimal one-letter-per-chunk word for bucket examples not in the seed bank. */
function plainWord(text: string): BeeWord {
  return {
    id: `word_${text}`,
    word: text,
    syllables: [text],
    phoneticRespelling: text,
    difficulty: 2,
    patternId: 'test-pattern',
    role: 'GUIDED',
    meanings: [],
    graphemeMap: text.split('').map((g, i) => ({ grapheme: g, phoneme: '', startIndex: i, endIndex: i })),
    traps: [],
    wordStory: '',
  }
}

describe('classifyAttempt', () => {
  it('accepts the correct spelling, ignoring case and separators', () => {
    const d = classifyAttempt(word('word_mysterious'), 'M-Y-S-T-E-R-I-O-U-S')
    expect(d).toMatchObject({ isCorrect: true, bucket: 'NONE', streakPenalty: false })
  })

  it('misterious -> PHONETIC_PATTERN_ERROR at index 1 (expected Y, got I, /ɪ/)', () => {
    const d = classifyAttempt(word('word_mysterious'), 'misterious')
    expect(d).toMatchObject({
      bucket: 'PHONETIC_PATTERN_ERROR',
      errorTileIndex: 1,
      expectedLetter: 'Y',
      gotLetter: 'I',
      patternId: 'y-as-short-i',
      streakPenalty: true,
    })
    expect(d.chunk?.phoneme).toBe('/ɪ/')
  })

  it('practise -> UK_US_VARIANT_TRAP with zero streak penalty', () => {
    const d = classifyAttempt(word('word_practice'), 'practise')
    expect(d).toMatchObject({ bucket: 'UK_US_VARIANT_TRAP', errorTileIndex: 6, streakPenalty: false })
    expect(d.matchedTrap?.candidatePair).toEqual(['C', 'S'])
  })

  it.each([
    ['word_knight', 'night'],
    ['word_sentence', 'sentense'],
    ['word_knowledge', 'nowledge'],
    ['word_office', 'offise'],
  ])('%s: %s -> PHONETIC_PATTERN_ERROR', (id, attempt) => {
    expect(classifyAttempt(word(id), attempt).bucket).toBe('PHONETIC_PATTERN_ERROR')
  })

  it('classifies un-authored sound-alike and silent-letter errors as pattern errors', () => {
    expect(classifyAttempt(word('word_practice'), 'praktice').bucket).toBe('PHONETIC_PATTERN_ERROR')
    expect(classifyAttempt(word('word_knight'), 'knit').bucket).toBe('PHONETIC_PATTERN_ERROR')
  })

  it.each([
    ['beginning', 'begining'],
    ['happiness', 'happyness'],
  ])('%s: %s -> AFFIX_JUNCTION_ERROR', (target, attempt) => {
    expect(classifyAttempt(plainWord(target), attempt).bucket).toBe('AFFIX_JUNCTION_ERROR')
  })

  it('diffrent -> SYLLABLE_OMISSION', () => {
    expect(classifyAttempt(plainWord('different'), 'diffrent').bucket).toBe('SYLLABLE_OMISSION')
  })

  it('adjacent transpositions and isolated typos -> MOTOR_SLIP', () => {
    expect(classifyAttempt(word('word_practice'), 'pratcice').bucket).toBe('MOTOR_SLIP')
    expect(classifyAttempt(word('word_mysterious'), 'mysterioua').bucket).toBe('MOTOR_SLIP')
    expect(classifyAttempt(word('word_sentence'), 'sentwnce').bucket).toBe('MOTOR_SLIP')
  })
})

describe('needsCoaching (conviction threshold)', () => {
  const opp = (wordId: string, bucket: PatternOpportunity['bucket'], patternId = 'silent-kn') => ({
    patternId,
    wordId,
    bucket,
  })

  it('never convicts on a single error', () => {
    expect(needsCoaching([opp('word_knight', 'PHONETIC_PATTERN_ERROR')], 'silent-kn')).toBe(false)
  })

  it('does not convict on repeated errors in the same word', () => {
    const log = [opp('word_knight', 'PHONETIC_PATTERN_ERROR'), opp('word_knight', 'PHONETIC_PATTERN_ERROR')]
    expect(needsCoaching(log, 'silent-kn')).toBe(false)
  })

  it('convicts on pattern errors in two distinct words', () => {
    const log = [opp('word_knight', 'PHONETIC_PATTERN_ERROR'), opp('word_knot', 'AFFIX_JUNCTION_ERROR')]
    expect(needsCoaching(log, 'silent-kn')).toBe(true)
  })

  it('ignores motor slips, UK/US variants and other patterns', () => {
    const log = [
      opp('word_knight', 'PHONETIC_PATTERN_ERROR'),
      opp('word_knot', 'MOTOR_SLIP'),
      opp('word_know', 'UK_US_VARIANT_TRAP'),
      opp('word_office', 'PHONETIC_PATTERN_ERROR', 'ice-vs-ise'),
    ]
    expect(needsCoaching(log, 'silent-kn')).toBe(false)
  })

  it('only looks at the last 10 opportunities for the pattern', () => {
    const log = [
      opp('word_knight', 'PHONETIC_PATTERN_ERROR'),
      ...Array.from({ length: 9 }, () => opp('word_know', 'NONE')),
      opp('word_knot', 'PHONETIC_PATTERN_ERROR'),
    ]
    expect(needsCoaching(log, 'silent-kn')).toBe(false)
    expect(needsCoaching(log.slice(1), 'silent-kn')).toBe(false)
    expect(needsCoaching([...log.slice(2), opp('word_kneel', 'PHONETIC_PATTERN_ERROR')], 'silent-kn')).toBe(true)
  })
})
