import { describe, expect, it } from 'vitest'
import { BASELINE, calibrate, type Outcome } from './zpdCalibrator.ts'

let n = 0
const o = (clean: boolean, difficulty = 2.4, extra: Partial<Outcome> = {}): Outcome => ({
  wordId: `w${n++}`,
  patternId: 'p',
  difficulty,
  clean,
  probe: false,
  ...extra,
})
const many = (count: number, clean: boolean, difficulty = 2.4) => Array.from({ length: count }, () => o(clean, difficulty))

describe('calibrate', () => {
  it('starts at the 2.2 baseline', () => {
    expect(calibrate([])).toMatchObject({ floor: BASELINE, target: BASELINE, floorSteps: 0 })
  })

  it('aims higher when she is above the 75-85% corridor, and never below the floor when she struggles', () => {
    const easy = calibrate(many(12, true, 2.6))
    expect(easy.recent10).toBe(1)
    expect(easy.target).toBeGreaterThan(2.6)
    const hard = calibrate(many(12, false, 2.6))
    expect(hard.target).toBe(BASELINE)
    expect(hard.streakMomentum).toBeLessThan(0)
  })

  it('uses the agreed formula: EMA + (recent10 - 0.80) * 1.5 + momentum', () => {
    const c = calibrate([...many(8, true, 3), o(false, 3), o(true, 3)])
    expect(c.recent10).toBe(0.9)
    expect(c.target).toBeCloseTo(c.historicalEMA + (0.9 - 0.8) * 1.5 + c.streakMomentum, 10)
  })

  it('raises the floor only with 85% over 15 words AND two families carried over to mystery words', () => {
    // Accuracy alone is not enough.
    expect(calibrate(many(30, true)).floorSteps).toBe(0)
    // Two families, two clean mystery words each, plus the accuracy.
    const probes = ['a', 'a', 'b', 'b'].map((patternId) => o(true, 2.6, { patternId, probe: true }))
    const stepped = calibrate([...many(11, true), ...probes])
    expect(stepped.transferred.sort()).toEqual(['a', 'b'])
    expect(stepped).toMatchObject({ floorSteps: 1, floor: BASELINE + 0.25 })
    // One clean mystery word in a family does not count as carried over.
    const one = ['a', 'b', 'c', 'd'].map((patternId) => o(true, 2.6, { patternId, probe: true }))
    expect(calibrate([...many(11, true), ...one]).floorSteps).toBe(0)
    // Nor does it step with the transfers but too many misses.
    expect(calibrate([...many(8, true), ...many(3, false), ...probes]).floorSteps).toBe(0)
  })

  it('needs two MORE families and 15 more words for each further step', () => {
    const probes = (ids: string[]) => ids.flatMap((patternId) => [o(true, 2.8, { patternId, probe: true }), o(true, 2.8, { patternId, probe: true })])
    const first = [...many(11, true), ...probes(['a', 'b'])]
    expect(calibrate([...first, ...many(15, true)]).floorSteps).toBe(1)
    expect(calibrate([...first, ...many(11, true), ...probes(['c', 'd'])]).floorSteps).toBe(2)
  })
})
