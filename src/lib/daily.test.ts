import { beforeEach, describe, expect, it } from 'vitest'
import { dailyPool, dailyWord, dayKey, pickDailyWord } from './daily.ts'

describe("today's word", () => {
  beforeEach(() => localStorage.clear())

  it('is the same all day and changes from day to day', () => {
    expect(pickDailyWord('2026-11-14', 2.2)).toBe(pickDailyWord('2026-11-14', 2.2))
    const month = Array.from({ length: 30 }, (_, i) => pickDailyWord(`2026-11-${String(i + 1).padStart(2, '0')}`, 2.2).id)
    expect(new Set(month).size).toBeGreaterThan(20)
  })

  it.each([2.2, 2.7, 3.2, 3.7, 4.2, 4.7])('at level %s it is a taught word a little above her level', (floor) => {
    const pool = dailyPool(floor)
    expect(pool.length).toBeGreaterThanOrEqual(20)
    for (const w of pool) expect(w.role).not.toBe('TRANSFER_PROBE')
    if (floor <= 2.7) for (const w of pool) expect(w.difficulty).toBeGreaterThanOrEqual(floor + 0.2)
  })

  it('does not change during the day when her level moves', () => {
    const first = dailyWord(2.2, '2026-11-14')
    expect(dailyWord(3.2, '2026-11-14')).toBe(first)
    expect(dailyWord(3.2, '2026-11-15')).toBe(pickDailyWord('2026-11-15', 3.2))
  })

  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
