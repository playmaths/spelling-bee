import { PATTERNS, getWord } from '../data/index.ts'
import { calibrate, type Calibration } from '../engine/zpdCalibrator.ts'
import type { PatternNode } from '../types/game.ts'
import type { Progress } from './unlocks.ts'

/** Her current level, worked out from every logged attempt. */
export function calibrationFor(progress: Progress): Calibration {
  return calibrate(
    (progress.history ?? []).flatMap((a) => {
      const w = getWord(a.w)
      return w ? [{ wordId: w.id, patternId: w.patternId, difficulty: w.difficulty, clean: a.r === 'CLEAN', probe: w.role === 'TRANSFER_PROBE' }] : []
    }),
  )
}

/** The bee ladder. Each bee asks harder words than her everyday level by `boost`. */
export const BEE_LEVELS = [
  { name: 'Classroom Bee', emoji: '🏫', boost: 0 },
  { name: 'School Bee', emoji: '🎒', boost: 0.2 },
  { name: 'District Bee', emoji: '🚌', boost: 0.4 },
  { name: 'Regional Bee', emoji: '🗺️', boost: 0.6 },
  { name: 'State Bee', emoji: '🏛️', boost: 0.9 },
  { name: 'National Bee', emoji: '🏆', boost: 1.2 },
] as const

/** Words right, out of eight, to win a bee and move up. */
export const WIN_AT = 6

export type RibbonKey = 'gold' | 'silver' | 'bronze' | 'brave'
export const RIBBONS: Record<RibbonKey, { emoji: string; name: string; line: string }> = {
  gold: { emoji: '🥇', name: 'Gold ribbon', line: 'Every single word! That is a gold ribbon round.' },
  silver: { emoji: '🥈', name: 'Silver ribbon', line: 'A silver ribbon round. Lovely spelling.' },
  bronze: { emoji: '🥉', name: 'Bronze ribbon', line: 'A bronze ribbon round. You are getting there.' },
  brave: { emoji: '🎗️', name: 'Brave speller ribbon', line: 'That was a hard round, and you finished it. That earns a brave speller ribbon.' },
}

export function ribbonFor(right: number, total: number): RibbonKey {
  if (right >= total) return 'gold'
  if (right >= WIN_AT) return 'silver'
  if (right >= total / 2) return 'bronze'
  return 'brave'
}

export const levelUpLine = (won: number) =>
  won + 1 < BEE_LEVELS.length
    ? `You won the ${BEE_LEVELS[won].name}! Next comes the ${BEE_LEVELS[won + 1].name}.`
    : `You won the ${BEE_LEVELS[won].name}! You are a champion speller.`

/** Every fixed line the stage can say at the end of a round (for recording). */
export const STAGE_LINES = [...Object.values(RIBBONS).map((r) => r.line), ...BEE_LEVELS.map((_, i) => levelUpLine(i))]

/** What a finished round changes: a ribbon, and the next bee if she won this one. */
export function afterRound(progress: Progress, right: number, total: number): { progress: Progress; ribbon: RibbonKey; wonLevel: number | null } {
  const level = Math.min(progress.stageLevel ?? 0, BEE_LEVELS.length - 1)
  const ribbon = ribbonFor(right, total)
  const won = right >= WIN_AT && (progress.beesWon ?? 0) <= level
  return {
    ribbon,
    wonLevel: won ? level : null,
    progress: {
      ...progress,
      ribbons: { ...progress.ribbons, [ribbon]: (progress.ribbons?.[ribbon] ?? 0) + 1 },
      ...(won ? { beesWon: level + 1, stageLevel: Math.min(level + 1, BEE_LEVELS.length - 1) } : {}),
    },
  }
}

/**
 * A family badge is earned by carrying its rule over: two of its mystery words
 * solved right first time. (The badge names come from the pattern data.)
 */
export function badgesEarned(solved: Progress['solved']): PatternNode[] {
  return PATTERNS.filter((p) => p.transferProbeIds.filter((id) => solved[id] === 'CLEAN').length >= 2)
}
