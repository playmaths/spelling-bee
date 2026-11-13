import type { BeeWord, PatternNode, WordCard } from '../types/game.ts'
import cardsJson from './cards.json'
import { expandFamily, type CompactFamily } from './expand.ts'
import patternsJson from './patterns.json'
import wordsJson from './words.json'

/**
 * The word bank = the first nine hand-written families (patterns/words/cards.json)
 * plus every compact family file in ./families, expanded at load time.
 */
const modules = import.meta.glob('./families/*.json', { eager: true, import: 'default' }) as Record<string, CompactFamily>
export const FAMILY_FILES: CompactFamily[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k])
const expanded = FAMILY_FILES.map(expandFamily)

/** Hidden kind labels for the nine hand-written families. */
const LEGACY_KINDS: Record<string, string> = {
  'ice-vs-ise': 'endings',
  'silent-kn': 'silent-letters',
  'y-as-short-i': 'origins',
  'soft-c-before-eiy': 'consonant-choices',
  'greek-ph': 'origins',
  'silent-wr': 'silent-letters',
  'soft-g-before-eiy': 'consonant-choices',
  'double-consonant-short-vowel': 'joining-rules',
  'tion-ending': 'endings',
}

/** One plain sentence per hand-written family, for the "what is the secret?" check. */
const LEGACY_SECRETS: Record<string, string> = {
  'ice-vs-ise': "The ending sounds like 'iss' but is spelled I-C-E, just like ICE 🧊.",
  'silent-kn': 'A quiet K hides in front of the N at the start.',
  'y-as-short-i': 'A sneaky Y is doing the job of the letter I.',
  'soft-c-before-eiy': "C says 'sss' because E, I or Y comes right after it.",
  'greek-ph': "P and H team up to say 'fff'.",
  'silent-wr': 'A quiet W hides in front of the R at the start.',
  'soft-g-before-eiy': "G says 'j' because E, I or Y comes right after it.",
  'double-consonant-short-vowel': 'Twin letters in the middle keep the first vowel short.',
  'tion-ending': "The 'shun' ending is spelled T-I-O-N.",
}

export const PATTERNS: PatternNode[] = [
  ...(patternsJson as unknown as PatternNode[]).map((p) => ({ ...p, kind: LEGACY_KINDS[p.patternId], secret: LEGACY_SECRETS[p.patternId] })),
  ...expanded.map((e) => e.pattern),
]
export const WORDS: BeeWord[] = [...(wordsJson as unknown as BeeWord[]), ...expanded.flatMap((e) => e.words)]
export const CARDS: WordCard[] = [...(cardsJson as unknown as WordCard[]), ...expanded.flatMap((e) => e.cards)]

const wordById = new Map(WORDS.map((w) => [w.id, w]))
const cardById = new Map(CARDS.map((c) => [c.wordId, c]))
const patternById = new Map(PATTERNS.map((p) => [p.patternId, p]))

export const getWord = (id: string): BeeWord | undefined => wordById.get(id)
export const getCard = (wordId: string): WordCard | undefined => cardById.get(wordId)
export const getPattern = (patternId: string): PatternNode | undefined => patternById.get(patternId)
