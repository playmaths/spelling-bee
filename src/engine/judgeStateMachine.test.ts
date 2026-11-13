import { describe, expect, it } from 'vitest'
import { getWord } from '../data/index.ts'
import { createJudge, judgeReducer, parseIntent, type JudgeState } from './judgeStateMachine.ts'

const mysterious = getWord('word_mysterious')!
const practice = getWord('word_practice')!

const submit = (s: JudgeState, attempt: string) => judgeReducer(s, { type: 'SUBMIT', attempt })

describe('parseIntent', () => {
  it.each([
    ['Can you use it in a sentence?', 'SENTENCE'],
    ['What does it mean?', 'DEFINITION'],
    ['Say it slowly', 'SLOW'],
    ['Word clue', 'CLUE'],
    ['Can you repeat the word?', 'REPEAT'],
  ])('%s -> %s', (utterance, intent) => {
    expect(parseIntent(utterance)).toBe(intent)
  })

  it('returns null for letter dictation', () => {
    expect(parseIntent('m y s t e r i o u s')).toBeNull()
  })
})

describe('ADVENTURE: mysterious', () => {
  it('first miss gives the non-revealing first-mismatch nudge', () => {
    const s = submit(createJudge(mysterious, 'ADVENTURE'), 'M-I-S-T-E-R-I-O-U-S')
    expect(s.phase).toBe('COACHING')
    expect(s.highlightTileIndex).toBe(1)
    expect(s.candidatePair).toBeNull()
    expect(s.line.spoken).toBe(
      "Nice attempt! Let's check your spelling. The first letter of **mysterious** is **M**, but listen to the next sound. Can you figure out which vowel comes next?",
    )
    expect(s.line.display).not.toMatch(/mysterious/i)
  })

  it('second miss reveals the trap response, Twin-Choice pair and memory trick', () => {
    let s = submit(createJudge(mysterious, 'ADVENTURE'), 'misterious')
    s = submit(s, 'misterious')
    expect(s.candidatePair).toEqual(['Y', 'I'])
    expect(s.line.display).toContain('sneaky Y')
    expect(s.line.display).toContain('Every good MYSTERY starts with M-Y-S!')
  })

  it('self-correction resolves as correct but not first-try unassisted', () => {
    let s = submit(createJudge(mysterious, 'ADVENTURE'), 'misterious')
    s = submit(s, 'mysterious')
    expect(s).toMatchObject({ phase: 'RESOLVED', outcome: 'CORRECT', firstTryUnassisted: false, attempts: 2 })
  })

  it('shows the answer after three misses', () => {
    let s = createJudge(mysterious, 'ADVENTURE')
    for (let i = 0; i < 3; i++) s = submit(s, 'misterious')
    expect(s).toMatchObject({ phase: 'RESOLVED', outcome: 'INCORRECT' })
    expect(s.line.display).toContain('M-Y-S-T-E-R-I-O-U-S')
    expect(submit(s, 'mysterious')).toBe(s)
  })
})

describe('ADVENTURE: practice / practise', () => {
  it('triggers an immediate zero-penalty Twin Alert', () => {
    const s = submit(createJudge(practice, 'ADVENTURE'), 'practise')
    expect(s.line.kind).toBe('TWIN_ALERT')
    expect(s.line.display).toMatch(/^British\/American Twin Alert!/)
    expect(s.line.display).toContain('PRACT-ICE')
    expect(s).toMatchObject({ highlightTileIndex: 6, candidatePair: ['C', 'S'], streakPenalty: false })
  })

  it('keeps the streak safe after fixing the twin', () => {
    const s = submit(submit(createJudge(practice, 'ADVENTURE'), 'practise'), 'practice')
    expect(s).toMatchObject({ outcome: 'CORRECT', streakPenalty: false })
  })
})

describe('CONTEST', () => {
  it('grades once with no mid-word coaching and queues a Coach note', () => {
    const s = submit(createJudge(mysterious, 'CONTEST'), 'misterious')
    expect(s).toMatchObject({ phase: 'RESOLVED', outcome: 'INCORRECT', candidatePair: null })
    expect(s.coachNote).toMatchObject({ patternId: 'y-as-short-i', bucket: 'PHONETIC_PATTERN_ERROR' })
  })

  it('marks a first-try hit as unassisted', () => {
    const s = submit(createJudge(practice, 'CONTEST'), 'practice')
    expect(s).toMatchObject({ outcome: 'CORRECT', firstTryUnassisted: true })
  })

  it('a British variant is still incorrect but costs no streak', () => {
    const s = submit(createJudge(practice, 'CONTEST'), 'practise')
    expect(s).toMatchObject({ outcome: 'INCORRECT', streakPenalty: false })
  })
})

describe('free intents', () => {
  it.each(['ADVENTURE', 'CONTEST'] as const)('never affect grading in %s', (mode) => {
    let s = createJudge(practice, mode)
    s = judgeReducer(s, { type: 'INTENT', intent: 'DEFINITION' })
    s = judgeReducer(s, { type: 'INTENT', intent: 'SENTENCE' })
    s = judgeReducer(s, { type: 'INTENT', intent: 'SLOW' })
    expect(s.phase).toBe('AWAITING_SPELLING')
    expect(s.intentCounts).toMatchObject({ DEFINITION: 1, SENTENCE: 1, SLOW: 1 })
    expect(submit(s, 'practice')).toMatchObject({ outcome: 'CORRECT', firstTryUnassisted: true })
  })

  it('speaks the sentence but displays it blanked', () => {
    const s = judgeReducer(createJudge(practice, 'CONTEST'), { type: 'INTENT', intent: 'SENTENCE' })
    expect(s.line.spoken).toContain('practice')
    expect(s.line.display).toContain('________')
    expect(s.line.display).not.toContain('practice')
  })

  it('cycles through meanings on repeated asks', () => {
    let s = judgeReducer(createJudge(practice, 'CONTEST'), { type: 'INTENT', intent: 'DEFINITION' })
    expect(s.line.display).toMatch(/^It's a verb/)
    s = judgeReducer(s, { type: 'INTENT', intent: 'DEFINITION' })
    expect(s.line.display).toMatch(/^It's a noun/)
  })
})

describe('clues', () => {
  const clue = (s: JudgeState) => judgeReducer(s, { type: 'INTENT', intent: 'CLUE' })

  it('gives words that mean nearly the same, not grammar facts', () => {
    const s = clue(createJudge(practice, 'CONTEST'))
    expect(s.line.display).toBe("Here's a clue. It means nearly the same as “train” or “rehearse”.")
    expect(s.line.display).not.toMatch(/noun|verb|beats/)
  })

  it('adds a nudge about the tricky part while learning, without showing the word', () => {
    const s = clue(clue(createJudge(mysterious, 'ADVENTURE')))
    expect(s.line.display).toMatch(/^Here's a clue about the tricky part\./)
    expect(s.line.display).not.toMatch(/mysterious/i)
  })

  it('never gives spelling help on the bee stage', () => {
    let s = createJudge(mysterious, 'CONTEST')
    for (let i = 0; i < 3; i++) {
      s = clue(s)
      expect(s.line.display).not.toMatch(/tricky part/)
    }
  })
})
