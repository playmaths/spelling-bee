import type { Attempt, Progress } from './unlocks.ts'
import { dayKey } from './daily.ts'

/**
 * Today's goals: two small things to do, each paid with a sticker for her book.
 * Every goal rewards doing (trying words, asking, spelling in full), never getting
 * things right, so a hard word counts as much as an easy one. Nothing is lost on a
 * day she does not play: there is no streak. Progress is read from her attempt
 * history, so it is the same on every synced device.
 */

export interface GoalDef {
  id: string
  icon: string
  label: string
  need: number
  /** How far today's attempts take her (may exceed `need`). */
  count: (today: Attempt[], earlier: Attempt[], dailyWordId: string, meaningsToday: number) => number
}

export const GOALS: GoalDef[] = [
  { id: 'words', icon: '🌼', label: 'Have a go at 5 words', need: 5, count: (t) => new Set(t.map((a) => a.w)).size },
  {
    id: 'spell',
    icon: '✏️',
    label: 'Spell 3 words letter by letter',
    need: 3,
    count: (t) => new Set(t.filter((a) => a.how !== 'PUZZLE').map((a) => a.w)).size,
  },
  { id: 'ask', icon: '❓', label: 'Ask the Judge about 2 words', need: 2, count: (t) => new Set(t.filter((a) => a.asks).map((a) => a.w)).size },
  { id: 'stage', icon: '🎤', label: 'Spell 4 words on the bee stage', need: 4, count: (t) => t.filter((a) => a.how === 'STAGE').length },
  {
    id: 'new',
    icon: '🌱',
    label: 'Meet 3 new words',
    need: 3,
    count: (t, earlier) => {
      const known = new Set(earlier.map((a) => a.w))
      return new Set(t.filter((a) => !known.has(a.w)).map((a) => a.w)).size
    },
  },
  { id: 'daily', icon: '☀️', label: "Try spelling today's word", need: 1, count: (t, _e, daily) => (t.some((a) => a.w === daily && a.how === 'SPELL') ? 1 : 0) },
  { id: 'meanings', icon: '💡', label: 'Find 6 words in Which word?', need: 6, count: (_t, _e, _d, found) => found },
]

/** Stickers, handed out in this order; when the sheet runs out it starts again. */
export const STICKERS = [
  '🦄', '🌈', '🐬', '🦋', '🍓', '🚀', '🐼', '⭐', '🧁', '🦊', '🐢', '🎈', '🌻', '🐙', '🍉', '🦉', '🐳', '🎨', '🍭', '🐝',
  '🦕', '🌙', '🐧', '🍒', '🎠', '🦜', '🐞', '🍩', '🪁', '🐰', '🌵', '🦁', '🍍', '🎪', '🐨', '💎', '🦩', '🍄', '🛸', '🐯',
  '🌷', '🦖', '🍪', '🎸', '🐸', '🪐', '🦔', '🍋', '🏰', '🐠', '☃️', '🦚', '🥝', '🎡', '🐿️', '🌺', '🦒', '🍇', '👑', '🐘',
]

function hash(text: string): number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/** The day's two goals: different from each other, the same on every device. */
export function goalsFor(day: string): [GoalDef, GoalDef] {
  const first = hash(day) % GOALS.length
  const second = (first + 1 + (hash(`${day}#`) % (GOALS.length - 1))) % GOALS.length
  return [GOALS[first], GOALS[second]]
}

export interface GoalState {
  goal: GoalDef
  /** 0..need */
  have: number
  done: boolean
  /** The sticker it paid, once it has. */
  sticker?: string
}

export const stickerKey = (day: string, goalId: string) => `${day}|${goalId}`

export function goalStates(progress: Progress, dailyWordId: string, day = dayKey()): GoalState[] {
  const history = progress.history ?? []
  const today = history.filter((a) => dayKey(new Date(a.t)) === day)
  const earlier = history.filter((a) => dayKey(new Date(a.t)) < day)
  const found = (progress.meanings ?? []).filter((t) => dayKey(new Date(t)) === day).length
  return goalsFor(day).map((goal) => {
    const sticker = progress.stickers?.[stickerKey(day, goal.id)]
    const have = Math.min(goal.need, goal.count(today, earlier, dailyWordId, found))
    // A sticker once given stays given, even if old attempts later drop off the history.
    return { goal, have: sticker ? goal.need : have, done: !!sticker || have >= goal.need, ...(sticker ? { sticker } : {}) }
  })
}

/** Stickers for any goal finished today that has not paid yet. Returns the same object if there is nothing new. */
export function awardStickers(progress: Progress, dailyWordId: string, day = dayKey()): { progress: Progress; fresh: string[] } {
  const stickers = { ...progress.stickers }
  const fresh: string[] = []
  for (const s of goalStates(progress, dailyWordId, day)) {
    const key = stickerKey(day, s.goal.id)
    if (!s.done || stickers[key]) continue
    const sticker = STICKERS[Object.keys(stickers).length % STICKERS.length]
    stickers[key] = sticker
    fresh.push(sticker)
  }
  return fresh.length ? { progress: { ...progress, stickers }, fresh } : { progress, fresh }
}

/** Her sticker book, oldest first. */
export const stickerBook = (progress: Progress): string[] =>
  Object.entries(progress.stickers ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, s]) => s)
