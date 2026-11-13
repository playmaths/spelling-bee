import { describe, expect, it } from 'vitest'
import { ROUND_SIZE, pickRound } from './Compete.tsx'

describe('pickRound', () => {
  it('never repeats a word across rounds until the pool runs out', () => {
    const seen: string[] = []
    let rounds = 0
    for (let i = 0; i < 50; i++) {
      const { words, startedOver } = pickRound({}, false, seen, i)
      if (startedOver) break
      expect(words).toHaveLength(ROUND_SIZE)
      for (const w of words) expect(seen).not.toContain(w.id)
      seen.push(...words.map((w) => w.id))
      rounds++
    }
    expect(rounds).toBeGreaterThanOrEqual(5)
  })

  it('gives a different round for a different draw', () => {
    const ids = (seed: number) => pickRound({}, false, [], seed).words.map((w) => w.id).join()
    expect(new Set([1, 2, 3, 4].map(ids)).size).toBeGreaterThan(1)
  })
})
