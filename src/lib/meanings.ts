import { WORDS } from '../data/index.ts'
import type { BeeWord } from '../types/game.ts'
import { LEVEL_FLOOR, seededShuffle } from './unlocks.ts'

/**
 * "Which word?" — she reads (or hears) a meaning and picks the word from four.
 * It grows vocabulary, so it shows whole words; held-back mystery words are
 * therefore never used, as an answer or as a wrong choice, until she has met them.
 */

export interface MeaningQuestion {
  word: BeeWord
  /** Which of the word's meanings is asked. */
  meaning: number
  /** Four words, one of them the answer. */
  choices: string[]
}

export const MEANING_ROUND = 8

/** Words that may be shown in full: at her level, and not a mystery word she has yet to meet. */
export function meaningPool(solved: Record<string, unknown>, unlockAll: boolean): BeeWord[] {
  return WORDS.filter(
    (w) => (w.difficulty >= LEVEL_FLOOR || w.id in solved) && (w.role !== 'TRANSFER_PROBE' || unlockAll || w.id in solved),
  )
}

const mentions = (text: string, word: string) => new RegExp(`\\b${word}`, 'i').test(text)

export function buildMeaningRound(
  solved: Record<string, unknown>,
  unlockAll: boolean,
  target: number,
  seed: number,
  size = MEANING_ROUND,
): MeaningQuestion[] {
  const pool = meaningPool(solved, unlockAll)
  // Words near her level, in a different order each round.
  const near = seededShuffle(pool, seed)
    .sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target))
    .slice(0, Math.max(size * 5, 40))
  const asked = seededShuffle(near, seed + 1).slice(0, size)
  return asked.map((word, n) => {
    const meaning = (seed + n) % word.meanings.length
    const m = word.meanings[meaning]
    // Wrong choices: the same kind of word where possible, from another family,
    // not too far from her level, and never a word the meaning itself uses.
    const fair = seededShuffle(pool, seed + 11 * (n + 1)).filter(
      (o) => o.patternId !== word.patternId && !mentions(m.kidDefinition, o.word) && !o.word.startsWith(word.word) && !word.word.startsWith(o.word),
    )
    const same = fair.filter((o) => o.meanings.some((x) => x.partOfSpeech === m.partOfSpeech))
    const wrong = [...same, ...fair].filter((o, i, all) => all.indexOf(o) === i).slice(0, 3)
    return { word, meaning, choices: seededShuffle([word.word, ...wrong.map((o) => o.word)], seed + n) }
  })
}
