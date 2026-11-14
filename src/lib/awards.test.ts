import { describe, expect, it } from 'vitest'
import { pickRound } from '../components/Compete.tsx'
import { WORDS } from '../data/index.ts'
import { BEE_LEVELS, STAGE_LINES, afterRound, badgesEarned, calibrationFor, ribbonFor } from './awards.ts'
import { mergeProgress } from './familySync.ts'
import { pickSession, type Attempt, type Progress } from './unlocks.ts'
import { buildVoiceManifest } from './voiceManifest.ts'

describe('ribbons and bees', () => {
  it('gives a ribbon for every round, whatever the score', () => {
    expect([8, 7, 6, 5, 4, 3, 0].map((n) => ribbonFor(n, 8))).toEqual(['gold', 'silver', 'silver', 'bronze', 'bronze', 'brave', 'brave'])
  })

  it('moves her up a bee when she spells six of eight, and never down', () => {
    let p: Progress = { solved: {} }
    const lost = afterRound(p, 3, 8)
    expect(lost).toMatchObject({ ribbon: 'brave', wonLevel: null })
    expect(lost.progress.stageLevel ?? 0).toBe(0)
    const won = afterRound(lost.progress, 6, 8)
    expect(won).toMatchObject({ ribbon: 'silver', wonLevel: 0 })
    expect(won.progress).toMatchObject({ stageLevel: 1, beesWon: 1, ribbons: { brave: 1, silver: 1 } })
    p = afterRound(won.progress, 2, 8).progress
    expect(p.stageLevel).toBe(1)
  })

  it('stops at the National Bee, which can be won once', () => {
    let p: Progress = { solved: {} }
    for (let i = 0; i < 10; i++) p = afterRound(p, 8, 8).progress
    expect(p).toMatchObject({ stageLevel: BEE_LEVELS.length - 1, beesWon: BEE_LEVELS.length, ribbons: { gold: 10 } })
  })

  it('keeps the higher bee and the larger ribbon counts when two devices sync', () => {
    const a: Progress = { solved: {}, stageLevel: 2, beesWon: 2, ribbons: { gold: 1 } }
    const b: Progress = { solved: {}, stageLevel: 1, beesWon: 1, ribbons: { gold: 3, brave: 2 } }
    expect(mergeProgress(a, b)).toMatchObject({ stageLevel: 2, beesWon: 2, ribbons: { gold: 3, brave: 2 } })
  })

  it('has every end-of-round line listed for recording', () => {
    const texts = new Set(buildVoiceManifest().clips.map((c) => c.text))
    for (const line of STAGE_LINES) expect(texts.has(line), line).toBe(true)
  })

  it('awards a family badge for two mystery words solved first time', () => {
    expect(badgesEarned({ word_knight: 'CLEAN', word_kneel: 'DONE' })).toEqual([])
    expect(badgesEarned({ word_knight: 'CLEAN', word_kneel: 'CLEAN' }).map((p) => p.patternId)).toEqual(['silent-kn'])
  })
})

describe('difficulty follows her', () => {
  const clean = (ids: string[]): Attempt[] => ids.map((w, i) => ({ t: i + 1, w, how: 'PUZZLE', r: 'CLEAN' }))

  it('serves harder words after a run of clean ones, and higher bees ask harder words still', () => {
    const start = pickSession({ solved: {} }, false)
    const history = clean(WORDS.filter((w) => w.difficulty >= 2.6 && w.difficulty <= 3.0 && w.role !== 'TRANSFER_PROBE').slice(0, 14).map((w) => w.id))
    const progress: Progress = { solved: Object.fromEntries(history.map((a) => [a.w, 'CLEAN' as const])), history }
    const target = calibrationFor(progress).target
    expect(target).toBeGreaterThan(2.8)
    const later = pickSession({ ...progress, sessions: 3 }, false, 5, target).filter((w) => !progress.solved[w.id])
    const avg = (ws: { difficulty: number }[]) => ws.reduce((s, w) => s + w.difficulty, 0) / ws.length
    expect(avg(later)).toBeGreaterThan(avg(start) + 0.3)

    const classroom = pickRound({}, true, [], 1, 2.2 + BEE_LEVELS[0].boost).words
    const national = pickRound({}, true, [], 1, 2.2 + BEE_LEVELS[5].boost).words
    expect(avg(national)).toBeGreaterThan(avg(classroom) + 0.6)
  })
})
