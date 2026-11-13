import type { BeeWord, ErrorBucket, GraphemeChunk, WordTrap } from '../types/game.ts'

/**
 * Contract 2 — Pattern Weakness vs. Motor Slip.
 * Pure, deterministic classification of one spelling attempt against a BeeWord.
 */

export interface Diagnosis {
  isCorrect: boolean
  bucket: ErrorBucket
  /** Normalised (lowercase a-z) attempt that was graded. */
  attempt: string
  /** First tile where the attempt departs from the target (trap-authored index wins). */
  errorTileIndex: number | null
  expectedLetter: string | null
  gotLetter: string | null
  /** Grapheme chunk containing the error tile. */
  chunk: GraphemeChunk | null
  matchedTrap: WordTrap | null
  /** Pattern implicated by this error (only for pattern-type buckets). */
  patternId: string | null
  /** UK/US variants never cost a streak. */
  streakPenalty: boolean
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y'])

/** Letter swaps that keep the word sounding (roughly) the same. */
const SOUND_ALIKE_PAIRS = [
  'cs', 'ck', 'kq', 'sz', 'iy', 'ie', 'ey', 'ae', 'ei', 'ou', 'jg', 'fv', 'ao', 'eu', 'au', 'io',
] as const
const SOUND_ALIKE = new Set<string>(SOUND_ALIKE_PAIRS.flatMap(([a, b]) => [a + b, b + a]))

const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const SUFFIXES = ['ness', 'ment', 'ful', 'less', 'ly', 'ing', 'ed', 'er', 'est', 'es', 'ous', 'able']

export function normalizeAttempt(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '')
}

export function isVowel(letter: string): boolean {
  return VOWELS.has(letter.toLowerCase())
}

export function chunkAt(word: BeeWord, index: number): GraphemeChunk | null {
  return word.graphemeMap.find((c) => index >= c.startIndex && index <= c.endIndex) ?? null
}

function firstMismatch(target: string, attempt: string): number {
  const n = Math.max(target.length, attempt.length)
  for (let i = 0; i < n; i++) if (target[i] !== attempt[i]) return i
  return -1
}

function isAdjacentTransposition(target: string, attempt: string): boolean {
  if (target.length !== attempt.length) return false
  const i = firstMismatch(target, attempt)
  return (
    i >= 0 &&
    i + 1 < target.length &&
    target[i] === attempt[i + 1] &&
    target[i + 1] === attempt[i] &&
    target.slice(i + 2) === attempt.slice(i + 2)
  )
}

function areKeyboardNeighbours(a: string, b: string): boolean {
  for (let r = 0; r < QWERTY_ROWS.length; r++) {
    const col = QWERTY_ROWS[r].indexOf(a)
    if (col < 0) continue
    for (let r2 = Math.max(0, r - 1); r2 <= Math.min(QWERTY_ROWS.length - 1, r + 1); r2++) {
      const col2 = QWERTY_ROWS[r2].indexOf(b)
      if (col2 >= 0 && Math.abs(col - col2) <= 1) return true
    }
  }
  return false
}

type Edit =
  | { op: 'sub'; index: number; expected: string; got: string }
  | { op: 'del'; index: number; expected: string } // letter missing from attempt
  | { op: 'ins'; index: number; got: string } // extra letter in attempt

/** Levenshtein alignment; `index` is always a position in the target word. */
export function alignEdits(target: string, attempt: string): Edit[] {
  const m = target.length
  const n = attempt.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = target[i - 1] === attempt[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j - 1] + cost, d[i - 1][j] + 1, d[i][j - 1] + 1)
    }
  }
  const edits: Edit[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && target[i - 1] === attempt[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      i--
      j--
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      edits.push({ op: 'sub', index: i - 1, expected: target[i - 1], got: attempt[j - 1] })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      edits.push({ op: 'del', index: i - 1, expected: target[i - 1] })
      i--
    } else {
      edits.push({ op: 'ins', index: i, got: attempt[j - 1] })
      j--
    }
  }
  return edits.reverse()
}

/** Is `index` the start of a common suffix, i.e. sitting on a root+suffix junction? */
function isSuffixJunction(target: string, index: number): boolean {
  return index > 1 && SUFFIXES.includes(target.slice(index))
}

function classifyEdit(word: BeeWord, edit: Edit): ErrorBucket {
  const target = word.word
  const chunk = chunkAt(word, Math.min(edit.index, target.length - 1))

  if (edit.op === 'del') {
    const twin = target[edit.index - 1] === edit.expected || target[edit.index + 1] === edit.expected
    // Dropped half of a doubled consonant: junction doubling rule (begining).
    if (twin && !isVowel(edit.expected)) {
      return chunk?.isPatternFocus ? 'PHONETIC_PATTERN_ERROR' : 'AFFIX_JUNCTION_ERROR'
    }
    // Dropped a silent partner inside a multi-letter grapheme (nowledge, nite-style).
    if (chunk && chunk.grapheme.length > 1 && (chunk.isPatternFocus || !isVowel(edit.expected))) {
      return 'PHONETIC_PATTERN_ERROR'
    }
    // Dropped a vowel: an unstressed syllable went missing (diffrent).
    if (isVowel(edit.expected)) return 'SYLLABLE_OMISSION'
    return 'MOTOR_SLIP'
  }

  if (edit.op === 'ins') {
    // Wrongly doubled a consonant at a junction (hopping for hoping).
    const doubled = target[edit.index - 1] === edit.got || target[edit.index] === edit.got
    if (doubled && !isVowel(edit.got) && isSuffixJunction(target, edit.index)) {
      return 'AFFIX_JUNCTION_ERROR'
    }
    return 'MOTOR_SLIP'
  }

  // Substitution
  const soundAlike = SOUND_ALIKE.has(edit.expected + edit.got)
  // y kept instead of changing to i before a suffix (happyness), and similar.
  if (soundAlike && isSuffixJunction(target, edit.index + 1) && !chunk?.isPatternFocus) {
    return 'AFFIX_JUNCTION_ERROR'
  }
  if (soundAlike) return 'PHONETIC_PATTERN_ERROR'
  if (areKeyboardNeighbours(edit.expected, edit.got)) return 'MOTOR_SLIP'
  return 'MOTOR_SLIP'
}

const BUCKET_PRIORITY: ErrorBucket[] = [
  'PHONETIC_PATTERN_ERROR',
  'AFFIX_JUNCTION_ERROR',
  'SYLLABLE_OMISSION',
  'MOTOR_SLIP',
]

export function isPatternBucket(bucket: ErrorBucket): boolean {
  return bucket === 'PHONETIC_PATTERN_ERROR' || bucket === 'AFFIX_JUNCTION_ERROR'
}

export function classifyAttempt(word: BeeWord, rawAttempt: string): Diagnosis {
  const target = word.word.toLowerCase()
  const attempt = normalizeAttempt(rawAttempt)

  const build = (bucket: ErrorBucket, index: number | null, trap: WordTrap | null): Diagnosis => ({
    isCorrect: bucket === 'NONE',
    bucket,
    attempt,
    errorTileIndex: index,
    expectedLetter: index === null ? null : (target[index]?.toUpperCase() ?? null),
    gotLetter: index === null ? null : (attempt[index]?.toUpperCase() ?? null),
    chunk: index === null ? null : chunkAt(word, Math.min(index, target.length - 1)),
    matchedTrap: trap,
    patternId: isPatternBucket(bucket) || bucket === 'UK_US_VARIANT_TRAP' ? word.patternId : null,
    streakPenalty: bucket !== 'NONE' && bucket !== 'UK_US_VARIANT_TRAP',
  })

  if (attempt === target) return build('NONE', null, null)

  // 1. Authored traps are authoritative.
  const trap = word.traps.find((t) => t.misspelling.toLowerCase() === attempt)
  if (trap) return build(trap.bucket, trap.errorTileIndex, trap)

  const mismatch = firstMismatch(target, attempt)

  // 2. Two neighbouring letters swapped: a hand slip, not a knowledge gap.
  if (isAdjacentTransposition(target, attempt)) return build('MOTOR_SLIP', mismatch, null)

  // 3. Classify each aligned edit; the most pattern-relevant bucket wins.
  const buckets = alignEdits(target, attempt).map((e) => classifyEdit(word, e))
  const bucket = BUCKET_PRIORITY.find((b) => buckets.includes(b)) ?? 'MOTOR_SLIP'
  return build(bucket, mismatch, null)
}

// ---------------------------------------------------------------------------
// Conviction threshold
// ---------------------------------------------------------------------------

/** One graded attempt at a word belonging to a pattern. */
export interface PatternOpportunity {
  patternId: string
  wordId: string
  bucket: ErrorBucket
}

export const CONVICTION_WINDOW = 10
export const CONVICTION_MIN_DISTINCT_WORDS = 2

/**
 * A pattern NEEDS_COACHING only when pattern-type errors hit >= 2 distinct words
 * within that pattern's most recent 10 opportunities.
 */
export function needsCoaching(log: readonly PatternOpportunity[], patternId: string): boolean {
  const recent = log.filter((o) => o.patternId === patternId).slice(-CONVICTION_WINDOW)
  const wordsWithPatternErrors = new Set(
    recent.filter((o) => isPatternBucket(o.bucket)).map((o) => o.wordId),
  )
  return wordsWithPatternErrors.size >= CONVICTION_MIN_DISTINCT_WORDS
}
