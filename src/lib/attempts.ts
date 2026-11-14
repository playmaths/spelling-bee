import type { JudgeState } from '../engine/judgeStateMachine.ts'
import type { Attempt, Progress } from './unlocks.ts'
import { HISTORY_CAP } from './unlocks.ts'

export type NewAttempt = Omit<Attempt, 't'>

/** Questions that show curiosity about the word (hearing it again does not count). */
const asksOf = (counts: JudgeState['intentCounts']) => counts.DEFINITION + counts.SENTENCE + counts.SLOW + counts.CLUE

/** What a finished Judge round says about how the word went. */
export function attemptFromJudge(state: JudgeState, how: 'SPELL' | 'STAGE'): NewAttempt {
  const firstMistake = state.diagnoses.find((d) => !d.isCorrect)
  return {
    w: state.word.id,
    how,
    r: state.outcome !== 'CORRECT' ? 'MISSED' : state.firstTryUnassisted ? 'CLEAN' : 'HELPED',
    ...(firstMistake ? { b: firstMistake.bucket } : {}),
    ...(asksOf(state.intentCounts) ? { asks: asksOf(state.intentCounts) } : {}),
  }
}

export function puzzleAttempt(wordId: string, solved: boolean, clean: boolean, counts: JudgeState['intentCounts']): NewAttempt {
  return {
    w: wordId,
    how: 'PUZZLE',
    r: !solved ? 'MISSED' : clean ? 'CLEAN' : 'HELPED',
    ...(asksOf(counts) ? { asks: asksOf(counts) } : {}),
  }
}

/** Adds an attempt to her saved progress. Stage rounds are logged but do not grow the garden. */
export function withAttempt(p: Progress, a: NewAttempt, now: number): Progress {
  const history = [...(p.history ?? []), { ...a, t: now }].slice(-HISTORY_CAP)
  const solved =
    a.how === 'STAGE' || p.solved[a.w] === 'CLEAN' ? p.solved : { ...p.solved, [a.w]: a.r === 'CLEAN' ? ('CLEAN' as const) : ('DONE' as const) }
  return { ...p, solved, history, savedAt: now }
}
