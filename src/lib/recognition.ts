import { PATTERNS } from '../data/index.ts'
import type { BeeWord } from '../types/game.ts'

export interface Check {
  question: string
  correctAnswer: string
  options: string[]
}

/**
 * The post-word check, in a child's words: "What is the secret of PRACTICE?"
 * The right answer is her family's one-sentence secret; the other two are the
 * secrets of different kinds of family, so they are plainly about other letters.
 * No sound symbols, no grammar terms.
 */
export function recognitionCheckFor(word: BeeWord): Check {
  const index = PATTERNS.findIndex((p) => p.patternId === word.patternId)
  const pattern = PATTERNS[index]
  const correct = pattern.secret ?? pattern.kidRule
  const n = PATTERNS.length
  const distractors: string[] = []
  for (let step = 1; distractors.length < 2 && step <= n; step++) {
    const other = PATTERNS[(index + step * 7 + word.word.length) % n]
    const text = other.secret ?? other.kidRule
    const sameKind = other.kind !== undefined && other.kind === pattern.kind
    // Keep the wrong answers short, so she compares ideas, not paragraphs.
    if (text.length > 90) continue
    if (other.patternId === pattern.patternId || sameKind || text === correct || distractors.includes(text)) continue
    distractors.push(text)
  }
  for (let step = 1; distractors.length < 2; step++) {
    const text = PATTERNS[(index + step) % n].secret ?? PATTERNS[(index + step) % n].kidRule
    if (text !== correct && !distractors.includes(text)) distractors.push(text)
  }
  const all = [correct, ...distractors]
  const shift = word.word.length % all.length
  return {
    question: `What is the secret of ${word.word.toUpperCase()}?`,
    correctAnswer: correct,
    options: [...all.slice(shift), ...all.slice(0, shift)],
  }
}

/** The emoji a family is known by (taken from its badge). */
export function familyEmoji(badgeName: string): string {
  return badgeName.match(/\p{Extended_Pictographic}/u)?.[0] ?? '🌼'
}
