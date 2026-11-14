import { describe, expect, it } from 'vitest'
import { mergeProgress, sameProgress } from './familySync.ts'
import { awardStickers, goalsFor, goalStates, GOALS, stickerBook, STICKERS } from './goals.ts'
import type { Attempt, Progress } from './unlocks.ts'

const DAY = '2026-11-14'
const at = (h: number, day = 14) => new Date(2026, 10, day, h).getTime()
const go = (w: string, how: Attempt['how'], h: number, extra: Partial<Attempt> = {}): Attempt => ({ t: at(h), w, how, r: 'MISSED', ...extra })
const state = (history: Attempt[], stickers?: Record<string, string>): Progress => ({ solved: {}, history, ...(stickers ? { stickers } : {}) })
const byId = (id: string) => GOALS.find((g) => g.id === id)!

describe("today's goals", () => {
  it('gives two different goals a day, and varies them across days', () => {
    const seen = new Set<string>()
    for (let d = 1; d <= 30; d++) {
      const [a, b] = goalsFor(`2026-11-${String(d).padStart(2, '0')}`)
      expect(a.id).not.toBe(b.id)
      seen.add(a.id).add(b.id)
    }
    expect(seen.size).toBe(GOALS.length)
    expect(goalsFor(DAY)).toEqual(goalsFor(DAY))
  })

  it('counts trying, not getting it right', () => {
    const today = ['a', 'b', 'c', 'd', 'e'].map((w, i) => go(w, 'PUZZLE', 9 + i))
    expect(byId('words').count(today, [], 'x', 0)).toBe(5)
    expect(byId('spell').count(today, [], 'x', 0)).toBe(0)
    expect(byId('spell').count([go('a', 'SPELL', 9), go('b', 'STAGE', 10), go('a', 'SPELL', 11)], [], 'x', 0)).toBe(2)
    expect(byId('ask').count([go('a', 'PUZZLE', 9, { asks: 2 }), go('b', 'PUZZLE', 10)], [], 'x', 0)).toBe(1)
    expect(byId('new').count(today, [go('a', 'PUZZLE', 9)], 'x', 0)).toBe(4)
    expect(byId('daily').count([go('x', 'PUZZLE', 9)], [], 'x', 0)).toBe(0)
    expect(byId('daily').count([go('x', 'SPELL', 9)], [], 'x', 0)).toBe(1)
  })

  it("only counts today's attempts", () => {
    const [g] = goalsFor(DAY)
    const yesterday = Array.from({ length: 8 }, (_, i) => ({ ...go(`w${i}`, 'STAGE', 9, { asks: 1 }), t: at(9, 13) + i }))
    const s = goalStates(state(yesterday), 'w0', DAY).find((x) => x.goal.id === g.id)!
    expect(s.have).toBe(0)
    expect(s.done).toBe(false)
  })

  it('pays one sticker per finished goal, once, and keeps it', () => {
    // Enough of everything to finish any goal.
    const busy = Array.from({ length: 8 }, (_, i) => ({ ...go(`w${i}`, i % 2 ? 'STAGE' : 'SPELL', 9, { asks: 1 }), t: at(9) + i }))
    const first = awardStickers(state([...busy, { ...go('w0', 'STAGE', 12), t: at(12) }, { ...go('w2', 'STAGE', 12), t: at(12) + 1 }]), 'w0', DAY)
    expect(first.fresh).toEqual([STICKERS[0], STICKERS[1]])
    expect([...stickerBook(first.progress)].sort()).toEqual([STICKERS[0], STICKERS[1]].sort())
    const again = awardStickers(first.progress, 'w0', DAY)
    expect(again.fresh).toEqual([])
    expect(again.progress).toBe(first.progress)
    // Still shown as done after the attempts are gone.
    const later = goalStates({ ...first.progress, history: [] }, 'w0', DAY)
    expect(later.every((s) => s.done && s.sticker)).toBe(true)
  })

  it('counts words found in Which word? today, right first go or not', () => {
    expect(byId('meanings').count([], [], 'x', 4)).toBe(4)
    const p: Progress = { solved: {}, meanings: [at(9, 13), at(9), at(10), at(11)] }
    const paid = awardStickers({ ...p, meanings: [...p.meanings!, at(12), at(13), at(14)] }, 'x', DAY)
    const plays = goalsFor(DAY).some((g) => g.id === 'meanings')
    expect(paid.fresh.length).toBe(plays ? 1 : 0)
    const merged = mergeProgress(p, { solved: {}, meanings: [at(9), at(15)] })
    expect(merged.meanings).toEqual([at(9, 13), at(9), at(10), at(11), at(15)])
  })

  it('pays nothing for an empty day', () => {
    const p = state([])
    expect(awardStickers(p, 'x', DAY)).toEqual({ progress: p, fresh: [] })
  })

  it('stickers survive a family sync from either device', () => {
    const a = state([], { [`${DAY}|words`]: '🦄' })
    const b = state([], { '2026-11-13|ask': '🌈' })
    const merged = mergeProgress(a, b)
    expect(merged.stickers).toEqual({ [`${DAY}|words`]: '🦄', '2026-11-13|ask': '🌈' })
    expect(sameProgress(a, merged)).toBe(false)
    expect(sameProgress(merged, mergeProgress(b, a))).toBe(true)
  })
})
