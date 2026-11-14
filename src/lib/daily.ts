import { WORDS, getWord } from '../data/index.ts'
import type { BeeWord } from '../types/game.ts'

/**
 * Today's word: one word a little above her level, the same all day, new at midnight.
 * Chosen from the date, so two devices at the same level show the same word.
 * It is shown in full on its card, so it is never a held-back mystery word.
 */

const DAILY_KEY = 'spelling-bee-daily'

/** Local calendar day, e.g. 2026-11-14. */
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function hash(text: string): number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Words a step above her floor that may be shown whole. */
export function dailyPool(floor: number): BeeWord[] {
  const taught = WORDS.filter((w) => w.role !== 'TRANSFER_PROBE')
  const band = taught.filter((w) => w.difficulty >= floor + 0.2 && w.difficulty <= floor + 1)
  // Near the top of the bank the band thins out; fall back to the hardest taught words.
  const pool = band.length >= 20 ? band : [...taught].sort((a, b) => b.difficulty - a.difficulty).slice(0, 40)
  return pool.sort((a, b) => a.id.localeCompare(b.id))
}

export function pickDailyWord(day: string, floor: number): BeeWord {
  const pool = dailyPool(floor)
  return pool[hash(day) % pool.length]
}

/** Today's word, remembered for the day so it does not change if her level moves this afternoon. */
export function dailyWord(floor: number, day = dayKey()): BeeWord {
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_KEY) ?? 'null') as { day: string; id: string } | null
    const kept = saved?.day === day ? getWord(saved.id) : undefined
    if (kept) return kept
  } catch {
    // No storage: the pick is still the same all day unless her level changes.
  }
  const word = pickDailyWord(day, floor)
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({ day, id: word.id }))
  } catch {
    // Fine without it.
  }
  return word
}
