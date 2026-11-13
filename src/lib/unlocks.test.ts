import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/index.ts'
import { LEVEL_FLOOR, pickSession, type Progress } from './unlocks.ts'

describe('pickSession', () => {
  it('starts with five easy taught words, mixed across families, never a probe', () => {
    const words = pickSession({ solved: {} }, false)
    expect(words).toHaveLength(5)
    expect(words.every((w) => w.role !== 'TRANSFER_PROBE')).toBe(true)
    const counts = new Map<string, number>()
    words.forEach((w) => counts.set(w.patternId, (counts.get(w.patternId) ?? 0) + 1))
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
    expect(Math.min(...words.map((w) => w.difficulty))).toBeGreaterThanOrEqual(LEVEL_FLOOR)
    expect(Math.max(...words.map((w) => w.difficulty))).toBeLessThan(2.6)
    expect(new Set(words.map((w) => w.id)).size).toBe(5)
  })

  it('moves on to new words and unlocks a family\'s probes once its taught words are solved', () => {
    const progress: Progress = { solved: {} }
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const words = pickSession(progress, false)
      if (words.every((w) => seen.has(w.id))) break
      words.forEach((w) => {
        seen.add(w.id)
        progress.solved[w.id] = 'CLEAN'
      })
    }
    expect(seen.size).toBe(WORDS.filter((w) => w.difficulty >= LEVEL_FLOOR).length)
  })

  it('still offers five review words when everything is solved', () => {
    const solved = Object.fromEntries(WORDS.map((w) => [w.id, 'CLEAN' as const]))
    expect(pickSession({ solved }, false)).toHaveLength(5)
  })

  it('gives a different mix on the next visit, even if nothing was solved', () => {
    const ids = (sessions: number) => pickSession({ solved: {}, sessions }, false).map((w) => w.id).join()
    expect(new Set([0, 1, 2, 3].map(ids)).size).toBeGreaterThan(1)
  })

  it('brings back a word she missed, and reviews one she solved cleanly', () => {
    const first = pickSession({ solved: {} }, false)
    const progress: Progress = { solved: { [first[0].id]: 'DONE' }, sessions: 1 }
    for (const w of WORDS.filter((x) => x.difficulty >= LEVEL_FLOOR && x.role === 'ANCHOR').slice(0, 6)) {
      if (w.id !== first[0].id) progress.solved[w.id] = 'CLEAN'
    }
    const next = pickSession(progress, false)
    expect(next.map((w) => w.id)).toContain(first[0].id)
    expect(next.some((w) => progress.solved[w.id] === 'CLEAN')).toBe(true)
    expect(next.filter((w) => !progress.solved[w.id]).length).toBeGreaterThanOrEqual(3)
  })
})
