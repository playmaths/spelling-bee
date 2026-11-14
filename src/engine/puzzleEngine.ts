import type { BeeWord } from '../types/game.ts'
import { chunkAt } from './diagnosticClassifier.ts'

/**
 * Sudoku-style deduction puzzle (prototype).
 * Most letters are givens; the tricky tiles are gaps with pencil candidates.
 * She hears the word, crosses out candidates, and commits. Three strikes, no score.
 * Pure reducer, like the Judge.
 */

export interface Gap {
  index: number
  answer: string
  candidates: string[]
  /** Pencil marks she (or a strike) has crossed out. */
  eliminated: string[]
  value: string | null
  filledByCoach: boolean
  hint: string | null
}

export type PuzzleStatus = 'PLAYING' | 'SOLVED' | 'OUT_OF_STRIKES'
export type CoachStage = 'IDLE' | 'LOOK' | 'EXPLAIN'

export interface PuzzleState {
  word: BeeWord
  gaps: Gap[]
  strikes: number
  status: PuzzleStatus
  /** Gap the coach is pointing at, and how far through Look -> Explain -> Apply it is. */
  coachGap: number | null
  coachStage: CoachStage
  /** True once the coach has filled a tile. */
  assisted: boolean
  feedback: string | null
}

export type PuzzleEvent =
  | { type: 'PLACE'; index: number; letter: string }
  | { type: 'TOGGLE_NOTE'; index: number; letter: string }
  | { type: 'COACH' }

export const MAX_STRIKES = 3
export const MAX_GAPS = 3
const CONFUSABLE: Record<string, string> = {
  A: 'EU', E: 'AI', I: 'EY', O: 'UA', U: 'OA', Y: 'IE',
  C: 'KS', K: 'CQ', S: 'CZ', Z: 'SX', G: 'JK', J: 'GD', F: 'VP', V: 'FB',
  P: 'BF', B: 'PD', D: 'TB', T: 'DP', M: 'N', N: 'M', Q: 'KC', X: 'KS', W: 'UV', R: 'WL', L: 'RW', H: 'WG',
}
/** Letters that are commonly silent in English spelling patterns. */
const SILENT_ANSWERS = new Set(['K', 'G', 'W', 'H', 'B', 'T', 'L', 'P'])
const SILENT_LETTERS = ['K', 'G', 'W', 'H', 'P', 'B']

/** Derives the gap tiles and their candidates from the word's authored traps. */
export function buildGaps(word: BeeWord): Gap[] {
  const target = word.word
  const byIndex = new Map<number, Set<string>>()

  for (const trap of word.traps) {
    const index = trap.errorTileIndex
    const answer = target[index]?.toUpperCase()
    if (!answer) continue
    const mis = trap.misspelling
    let candidates: string[] | null = null

    if (mis.length === target.length) {
      // Only single-tile swaps make a fair gap (knuckel/knuckle differs in two tiles).
      const diffs = [...target].filter((ch, i) => mis[i] !== ch).length
      if (diffs === 1) candidates = [answer, mis[index].toUpperCase()]
    } else if (
      chunkAt(word, index)?.isPatternFocus &&
      mis === target.slice(0, index) + target.slice(index + 1) &&
      target[index + 1] !== target[index] &&
      target[index - 1] !== target[index]
    ) {
      // A dropped silent letter (night for knight): offer the usual silent suspects.
      // Dropped twins (rabit) and respelled digraphs (elefant) do not make a fair single gap.
      // Never offer a letter that is already sitting in the word as a given.
      // Only truly silent letters get silent suspects; a dropped letter in a vowel team
      // or ending (pla for play) gets letters a child might actually reach for.
      const pool = SILENT_ANSWERS.has(answer) ? SILENT_LETTERS : (CONFUSABLE[answer] ?? 'KGH').split('')
      let others = pool.filter((l) => l !== answer && !target.toUpperCase().includes(l))
      if (others.length === 0) others = pool.filter((l) => l !== answer)
      if (others.length === 0) others = ['E', 'A', 'O'].filter((l) => l !== answer)
      candidates = [answer, ...others.slice(0, 2)]
    }
    if (!candidates) continue
    const set = byIndex.get(index) ?? new Set<string>()
    candidates.forEach((c) => set.add(c))
    byIndex.set(index, set)
  }

  // Every word must be playable: with no usable trap, hide the first letter of the
  // pattern and offer letters a child might plausibly reach for instead.
  if (byIndex.size === 0) {
    const chunk = word.graphemeMap.find((c) => c.isPatternFocus) ?? word.graphemeMap[0]
    const index = chunk.startIndex
    const answer = target[index].toUpperCase()
    const pool = (CONFUSABLE[answer] ?? 'KGH').split('').filter((l) => l !== answer)
    byIndex.set(index, new Set([answer, ...pool.slice(0, 2)]))
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, MAX_GAPS)
    .map(([index, set]) => ({
      index,
      answer: target[index].toUpperCase(),
      candidates: [target[index].toUpperCase(), ...[...set].filter((c) => c !== target[index].toUpperCase()).slice(0, 2)].sort(),
      eliminated: [],
      value: null,
      filledByCoach: false,
      hint: chunkAt(word, index)?.coachingHint ?? null,
    }))
}

export function createPuzzle(word: BeeWord): PuzzleState {
  return {
    word,
    gaps: buildGaps(word),
    strikes: 0,
    status: 'PLAYING',
    coachGap: null,
    coachStage: 'IDLE',
    assisted: false,
    feedback: null,
  }
}

/** Solved with no strikes and no coach fill. */
export function isCleanSolve(state: PuzzleState): boolean {
  return state.status === 'SOLVED' && state.strikes === 0 && !state.assisted
}

const firstOpenGap = (gaps: Gap[]) => gaps.find((g) => g.value === null) ?? null

function withGap(state: PuzzleState, index: number, patch: Partial<Gap>): Gap[] {
  return state.gaps.map((g) => (g.index === index ? { ...g, ...patch } : g))
}

function settle(state: PuzzleState, gaps: Gap[], feedback: string): PuzzleState {
  const solved = gaps.every((g) => g.value !== null)
  return {
    ...state,
    gaps,
    feedback,
    status: solved ? 'SOLVED' : state.status,
    coachGap: null,
    coachStage: 'IDLE',
  }
}

export function puzzleReducer(state: PuzzleState, event: PuzzleEvent): PuzzleState {
  if (state.status !== 'PLAYING') return state

  if (event.type === 'COACH') {
    const gap = state.gaps.find((g) => g.index === state.coachGap && g.value === null) ?? firstOpenGap(state.gaps)
    if (!gap) return state
    if (state.coachStage === 'IDLE' || state.coachGap !== gap.index) {
      return { ...state, coachGap: gap.index, coachStage: 'LOOK', feedback: `Look here: box ${gap.index + 1}.` }
    }
    if (state.coachStage === 'LOOK') {
      return {
        ...state,
        coachStage: 'EXPLAIN',
        feedback: gap.hint ?? 'Say the word slowly and listen to this exact sound.',
      }
    }
    const gaps = withGap(state, gap.index, { value: gap.answer, filledByCoach: true })
    return { ...settle(state, gaps, `Box ${gap.index + 1} is ${gap.answer}.`), assisted: true }
  }

  const gap = state.gaps.find((g) => g.index === event.index)
  const letter = event.letter.toUpperCase()
  if (!gap || gap.value !== null || !gap.candidates.includes(letter)) return state

  if (event.type === 'TOGGLE_NOTE') {
    const eliminated = gap.eliminated.includes(letter)
      ? gap.eliminated.filter((l) => l !== letter)
      : [...gap.eliminated, letter]
    return { ...state, gaps: withGap(state, gap.index, { eliminated }) }
  }

  if (letter === gap.answer) {
    return settle(state, withGap(state, gap.index, { value: letter }), `Yes! ${letter} fits box ${gap.index + 1}.`)
  }

  const strikes = state.strikes + 1
  const eliminated = gap.eliminated.includes(letter) ? gap.eliminated : [...gap.eliminated, letter]
  if (strikes >= MAX_STRIKES) {
    return {
      ...state,
      strikes,
      status: 'OUT_OF_STRIKES',
      gaps: state.gaps.map((g) => (g.value === null ? { ...g, value: g.answer, filledByCoach: true } : g)),
      feedback: 'That one was tricky! Here is the whole word. We will meet it again soon.',
      coachGap: null,
      coachStage: 'IDLE',
    }
  }
  return {
    ...state,
    strikes,
    gaps: withGap(state, gap.index, { eliminated }),
    feedback: `Not ${letter}. Listen again and have another go!`,
  }
}
