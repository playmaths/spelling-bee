import { describe, expect, it } from 'vitest'
import { getPattern, getWord } from '../data/index.ts'
import { mergeProgress } from './familySync.ts'
import { buildInsights, unlabelledKinds } from './insights.ts'
import type { Attempt, Progress } from './unlocks.ts'

let clock = 1_700_000_000_000
const go = (word: string, r: Attempt['r'], extra: Partial<Attempt> = {}): Attempt => ({
  t: (clock += 60_000),
  w: `word_${word}`,
  how: 'PUZZLE',
  r,
  ...extra,
})
const report = (history: Attempt[]) => buildInsights({ solved: {}, history })

describe('parent report', () => {
  it('says so when there is too little to go on', () => {
    const i = report([go('practice', 'CLEAN')])
    expect(i.enough).toBe(false)
    expect(i.recommendations[0]).toMatch(/not enough to go on/)
  })

  it('names a strength only with three or more attempts, mostly clean', () => {
    const i = report([go('know'.replace('know', 'knowledge'), 'CLEAN'), go('knead', 'CLEAN'), go('knapsack', 'CLEAN'), go('practice', 'CLEAN')])
    expect(i.strengths.map((s) => s.patternId)).toEqual(['silent-kn'])
  })

  it('does not call a family weak after one miss, but does after two different words', () => {
    const one = report([go('wrench', 'MISSED'), go('wrench', 'MISSED'), go('wrapper', 'CLEAN')])
    expect(one.focus).toEqual([])
    const two = report([go('wrench', 'MISSED'), go('wrapper', 'HELPED'), go('wriggle', 'CLEAN')])
    expect(two.focus[0]).toMatchObject({ patternId: 'silent-wr', struggled: ['wrapper', 'wrench'] })
  })

  it('recommends by where her first-try rate sits against the 75-85% sweet spot', () => {
    const words = ['practice', 'sentence', 'notice', 'gentle', 'nation', 'pattern', 'cabbage', 'mammal', 'ginger', 'imagine', 'wrench', 'wrapper', 'knead', 'system', 'station', 'elephant']
    const run = (cleanCount: number) => report(words.map((w, n) => go(w, n < cleanCount ? 'CLEAN' : 'MISSED'))).recommendations[0]
    expect(run(16)).toMatch(/ready for harder/)
    expect(run(13)).toMatch(/sweet spot \(75–85%\)/)
    expect(run(8)).toMatch(/stretch/)
  })

  it('reads mystery words as carrying a rule over, or not', () => {
    const filler = ['practice', 'sentence', 'notice', 'gentle', 'nation', 'pattern', 'cabbage'].map((w) => go(w, 'CLEAN'))
    const probes = ['knight', 'kneel', 'knuckle']
    for (const w of probes) expect(getWord(`word_${w}`)!.role).toBe('TRANSFER_PROBE')
    expect(report([...filler, ...probes.map((w) => go(w, 'CLEAN'))]).recommendations.join(' ')).toMatch(/applying the rules/)
    expect(report([...filler, ...probes.map((w) => go(w, 'MISSED'))]).recommendations.join(' ')).toMatch(/does not yet carry the rule/)
  })

  it('counts kinds of mistake and suggests what to do about the commonest', () => {
    const filler = ['practice', 'sentence', 'notice', 'gentle', 'nation', 'pattern', 'cabbage'].map((w) => go(w, 'CLEAN'))
    const slips = ['planning', 'arriving', 'hurried'].map((w) => go(w, 'HELPED', { how: 'SPELL', b: 'MOTOR_SLIP' }))
    const i = report([...filler, ...slips])
    expect(i.mistakes[0]).toMatchObject({ label: 'Slip of the hand', count: 3 })
    expect(i.recommendations.join(' ')).toMatch(/read her letters back/)
  })

  it('has a parent-facing label for every kind of family, and a secret for every family', () => {
    expect(unlabelledKinds()).toEqual([])
    expect(getPattern('silent-kn')!.secret).toBeTruthy()
  })
})

describe('attempt history across devices', () => {
  it('is combined without duplicates, oldest first', () => {
    const a: Progress = { solved: {}, history: [go('practice', 'CLEAN'), go('notice', 'MISSED')] }
    const b: Progress = { solved: {}, history: [a.history![0], go('gentle', 'CLEAN')] }
    const merged = mergeProgress(a, b).history!
    expect(merged.map((x) => x.w)).toEqual(['word_practice', 'word_notice', 'word_gentle'])
  })
})
