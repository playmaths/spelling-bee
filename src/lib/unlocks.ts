import { PATTERNS, WORDS } from '../data/index.ts'
import type { BeeWord } from '../types/game.ts'

const WORDS_BY_ID = new Map(WORDS.map((w) => [w.id, w]))

/** One go at one word, kept for the parent report. Short keys: this list is synced. */
export interface Attempt {
  /** When (epoch ms). */
  t: number
  /** Word id. */
  w: string
  /** A fill-the-gap puzzle, a full spell-out while learning, or the bee stage. */
  how: 'PUZZLE' | 'SPELL' | 'STAGE'
  /** Right first time with no help; right after help or a second try; or not solved. */
  r: 'CLEAN' | 'HELPED' | 'MISSED'
  /** For spelled-out words that went wrong: the kind of mistake (an ErrorBucket). */
  b?: string
  /** How many questions she asked the Judge first (meaning, sentence, slow, clue). */
  asks?: number
}

export const HISTORY_CAP = 800

export interface Progress {
  /** wordId -> best result so far. */
  solved: Record<string, 'CLEAN' | 'DONE'>
  /** How many Play sessions she has started; makes each session's mix different. */
  sessions?: number
  /** Write clock for family sync: set whenever she makes progress, never by joining a family. */
  savedAt?: number
  /** Words already asked on the bee stage, so a new round asks different ones. */
  stageSeen?: string[]
  /** Her last attempts, oldest first (at most HISTORY_CAP). */
  history?: Attempt[]
}

export const SESSION_SIZE = 5

/** Her starting level (the 2.2 baseline in CLAUDE.md). Words below this are never served. */
export const LEVEL_FLOOR = 2.2
const atLevel = (w: BeeWord) => w.difficulty >= LEVEL_FLOOR

/**
 * Prototype stand-in for the transfer engine: a probe unlocks once every taught
 * word in its family has been solved (no 24-hour wait yet).
 */
export function isLocked(word: BeeWord, solved: Record<string, unknown>, unlockAll: boolean): boolean {
  if (word.role !== 'TRANSFER_PROBE' || unlockAll) return false
  const pattern = PATTERNS.find((p) => p.patternId === word.patternId)
  if (!pattern) return true
  // Only taught words at her level count; easier ones are never served, so they cannot hold a probe back.
  const taught = [...pattern.anchorWordIds, ...pattern.guidedWordIds].map((id) => WORDS_BY_ID.get(id)).filter((w) => w && atLevel(w))
  return !taught.every((w) => solved[w!.id])
}

export function unlockedWords(solved: Record<string, unknown>, unlockAll: boolean): BeeWord[] {
  return WORDS.filter((w) => atLevel(w) && !isLocked(w, solved, unlockAll))
}

/**
 * Today's words. Never the same five twice:
 * - mostly NEW words, drawn at random from the dozen easiest she has not solved
 *   (at most two from one family), so the mix changes but the level still climbs;
 * - one word she MISSED before (needed help or ran out of flowers), to try again;
 * - one word she already solved cleanly, as a quick review.
 * `progress.sessions` seeds the draw, so each visit differs but a test can replay it.
 */
export function pickSession(progress: Progress, unlockAll: boolean, size = SESSION_SIZE): BeeWord[] {
  const seed = (progress.sessions ?? 0) + 1
  const open = unlockedWords(progress.solved, unlockAll).sort((a, b) => a.difficulty - b.difficulty)
  const fresh = open.filter((w) => !progress.solved[w.id])
  const missed = open.filter((w) => progress.solved[w.id] === 'DONE')
  const clean = open.filter((w) => progress.solved[w.id] === 'CLEAN')

  const perFamily = new Map<string, number>()
  const pool: BeeWord[] = []
  for (const w of fresh) {
    const n = perFamily.get(w.patternId) ?? 0
    if (n >= 2) continue
    perFamily.set(w.patternId, n + 1)
    pool.push(w)
    if (pool.length === 12) break
  }

  const picked: BeeWord[] = []
  const add = (w: BeeWord | undefined) => {
    if (w && picked.length < size && !picked.includes(w)) picked.push(w)
  }
  if (fresh.length > 0) {
    add(seededShuffle(missed, seed)[0])
    if (clean.length >= SESSION_SIZE) add(seededShuffle(clean, seed)[0])
  }
  for (const w of seededShuffle(pool, seed)) add(w)
  // Running out of new words: fall back to missed words, then anything unlocked.
  for (const w of [...fresh, ...seededShuffle(missed, seed), ...seededShuffle(open, seed)]) add(w)
  return seededShuffle(picked, seed + 7)
}

/** Deterministic shuffle so a round can be replayed in tests. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items]
  let s = (seed * 2654435761 + 12345) >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
