import { describe, expect, it } from 'vitest'
import { WORDS, getWord } from '../data/index.ts'
import { buildGaps, createPuzzle, isCleanSolve, puzzleReducer, type PuzzleState } from './puzzleEngine.ts'

const place = (s: PuzzleState, index: number, letter: string) => puzzleReducer(s, { type: 'PLACE', index, letter })
const coach = (s: PuzzleState) => puzzleReducer(s, { type: 'COACH' })

describe('buildGaps', () => {
  it.each(WORDS.map((w) => [w.word, w] as const))('%s has fair gaps', (_, w) => {
    const gaps = buildGaps(w)
    expect(gaps.length).toBeGreaterThanOrEqual(1)
    expect(gaps.length).toBeLessThanOrEqual(3)
    for (const g of gaps) {
      expect(g.answer).toBe(w.word[g.index].toUpperCase())
      expect(g.candidates).toContain(g.answer)
      expect(g.candidates.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('mysterious hides the sneaky vowel with I | Y candidates', () => {
    expect(buildGaps(getWord('word_mysterious')!)).toMatchObject([{ index: 1, answer: 'Y', candidates: ['I', 'Y'] }])
  })

  it('silent-letter words offer silent suspects', () => {
    expect(buildGaps(getWord('word_knight')!)[0]).toMatchObject({ index: 0, answer: 'K', candidates: ['K', 'P', 'W'] })
  })
})

describe('puzzleReducer', () => {
  const pyramid = () => createPuzzle(getWord('word_pyramid')!)

  it('a clean solve needs no strikes and no coach', () => {
    let s = pyramid()
    for (const g of s.gaps) s = place(s, g.index, g.answer)
    expect(s.status).toBe('SOLVED')
    expect(isCleanSolve(s)).toBe(true)
  })

  it('a wrong letter costs a strike and is crossed out', () => {
    const s = place(pyramid(), 1, 'I')
    expect(s.strikes).toBe(1)
    expect(s.gaps[0]).toMatchObject({ value: null, eliminated: ['I'] })
    expect(s.feedback).toMatch(/^Not I/)
  })

  it('three strikes end the puzzle and reveal the word', () => {
    let s = pyramid()
    s = place(s, 1, 'I')
    s = place(s, 3, 'I')
    s = place(s, 5, 'Y')
    expect(s.status).toBe('OUT_OF_STRIKES')
    expect(s.gaps.every((g) => g.value === g.answer)).toBe(true)
    expect(place(s, 1, 'Y')).toBe(s)
  })

  it('pencil notes are free and can be undone', () => {
    let s = puzzleReducer(pyramid(), { type: 'TOGGLE_NOTE', index: 1, letter: 'I' })
    expect(s.gaps[0].eliminated).toEqual(['I'])
    expect(s.strikes).toBe(0)
    s = puzzleReducer(s, { type: 'TOGGLE_NOTE', index: 1, letter: 'I' })
    expect(s.gaps[0].eliminated).toEqual([])
  })

  it('the coach goes Look here -> Explain -> Apply and marks the solve assisted', () => {
    let s = coach(pyramid())
    expect(s).toMatchObject({ coachGap: 1, coachStage: 'LOOK', assisted: false })
    s = coach(s)
    expect(s.coachStage).toBe('EXPLAIN')
    expect(s.gaps[0].value).toBeNull()
    s = coach(s)
    expect(s.gaps[0]).toMatchObject({ value: 'Y', filledByCoach: true })
    expect(s.assisted).toBe(true)
    s = place(place(s, 3, 'A'), 5, 'I')
    expect(s.status).toBe('SOLVED')
    expect(isCleanSolve(s)).toBe(false)
  })
})
