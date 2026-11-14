import { describe, expect, it } from 'vitest'
import { getWord, WORDS } from '../data/index.ts'
import { buildMeaningRound, meaningPool, MEANING_ROUND } from './meanings.ts'

const byWord = (w: string) => WORDS.find((x) => x.word === w)!

describe('which-word rounds', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('round %i asks eight fair questions', (seed) => {
    const round = buildMeaningRound({}, false, 2.6, seed)
    expect(round).toHaveLength(MEANING_ROUND)
    expect(new Set(round.map((q) => q.word.id)).size).toBe(MEANING_ROUND)
    for (const q of round) {
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices).size).toBe(4)
      expect(q.choices).toContain(q.word.word)
      const text = q.word.meanings[q.meaning].kidDefinition
      for (const c of q.choices) {
        const other = byWord(c)
        // Mystery words stay hidden, and no wrong choice comes from the answer's family.
        expect(other.role, c).not.toBe('TRANSFER_PROBE')
        if (c !== q.word.word) {
          expect(other.patternId).not.toBe(q.word.patternId)
          expect(text.toLowerCase()).not.toMatch(new RegExp(`\\b${c}`))
        }
      }
    }
  })

  it('changes from round to round', () => {
    const a = buildMeaningRound({}, false, 2.6, 1).map((q) => q.word.id)
    const b = buildMeaningRound({}, false, 2.6, 2).map((q) => q.word.id)
    expect(a).not.toEqual(b)
  })

  it('lets a mystery word in once she has met it', () => {
    const probe = WORDS.find((w) => w.role === 'TRANSFER_PROBE')!
    expect(meaningPool({}, false)).not.toContain(probe)
    expect(meaningPool({ [probe.id]: 'CLEAN' }, false)).toContain(getWord(probe.id))
  })
})
