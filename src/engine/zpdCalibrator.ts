/**
 * Contract 4 — difficulty that follows her ability.
 * Aim: she gets 75-85% of words right first time with no help.
 *
 *   accuracyDelta    = (recent10Accuracy - 0.80) * 1.5      // +0.30 at 100%, -0.45 at 50%
 *   targetDifficulty = clamp(historicalEMA + accuracyDelta + streakMomentum, floor, 5.0)
 *
 * The floor starts at 2.2 and steps up by 0.25 only when her last 15 words were at
 * least 85% right first time AND two more word families have been carried over to
 * mystery words. Pure and deterministic: the same history gives the same level.
 */
export interface Outcome {
  wordId: string
  patternId: string
  difficulty: number
  /** Right first time with no help. */
  clean: boolean
  /** A mystery word: never taught, only met later. */
  probe: boolean
}

export interface Calibration {
  /** The lowest level she will be served. */
  floor: number
  floorSteps: number
  historicalEMA: number
  /** Share right first time over the last 10 and 15 words (null until there are enough). */
  recent10: number | null
  rolling15: number | null
  streakMomentum: number
  /** The difficulty to aim words at now. */
  target: number
  /** Families she has carried over to at least two mystery words. */
  transferred: string[]
}

export const BASELINE = 2.2
export const FLOOR_STEP = 0.25
export const MAX_FLOOR = 4.0
export const MAX_DIFFICULTY = 5.0
const ALPHA = 0.15

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const accuracy = (list: Outcome[]) => list.filter((o) => o.clean).length / list.length

export function calibrate(outcomes: readonly Outcome[]): Calibration {
  let ema = BASELINE
  let floorSteps = 0
  let sinceStep = 0
  const cleanProbes = new Map<string, Set<string>>()
  const transferred = new Set<string>()

  outcomes.forEach((o, i) => {
    // A word she got clean shows she can work a little above it; a miss, a little below.
    ema += ALPHA * ((o.clean ? o.difficulty + 0.15 : o.difficulty - 0.45) - ema)
    if (o.probe && o.clean) {
      const set = cleanProbes.get(o.patternId) ?? new Set<string>()
      set.add(o.wordId)
      cleanProbes.set(o.patternId, set)
      if (set.size >= 2) transferred.add(o.patternId)
    }
    sinceStep++
    const last15 = outcomes.slice(Math.max(0, i - 14), i + 1)
    if (
      last15.length === 15 &&
      sinceStep >= 15 &&
      accuracy(last15) >= 0.85 &&
      transferred.size >= 2 * (floorSteps + 1) &&
      BASELINE + (floorSteps + 1) * FLOOR_STEP <= MAX_FLOOR
    ) {
      floorSteps++
      sinceStep = 0
    }
  })

  const floor = BASELINE + floorSteps * FLOOR_STEP
  const last10 = outcomes.slice(-10)
  const last15 = outcomes.slice(-15)
  const recent10 = last10.length >= 5 ? accuracy(last10) : null
  const rolling15 = last15.length === 15 ? accuracy(last15) : null

  // A run of clean words leans upward; two misses in a row lean down.
  let run = 0
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i].clean === outcomes[outcomes.length - 1].clean; i--) run++
  const lastClean = outcomes.length > 0 && outcomes[outcomes.length - 1].clean
  const streakMomentum = outcomes.length === 0 ? 0 : lastClean ? Math.min(run, 4) * 0.05 : run >= 2 ? -0.1 : 0

  const accuracyDelta = recent10 === null ? 0 : (recent10 - 0.8) * 1.5
  return {
    floor,
    floorSteps,
    historicalEMA: ema,
    recent10,
    rolling15,
    streakMomentum,
    target: clamp(ema + accuracyDelta + streakMomentum, floor, MAX_DIFFICULTY),
    transferred: [...transferred],
  }
}
