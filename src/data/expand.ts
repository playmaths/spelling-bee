import type { BeeWord, ErrorBucket, GraphemeChunk, PatternNode, WordCard, WordTrap } from '../types/game.ts'

/**
 * Compact authoring format for a word family. One file per family in
 * `src/data/families/`. Everything mechanical (ids, tile indices, blanked
 * sentences, grapheme maps, trap wiring) is derived here, so adding a word is
 * a few lines of content, not a page of JSON.
 */
export interface CompactWord {
  /** The word, lowercase. */
  w: string
  /** Syllables joined with "-": "mys-te-ri-ous". */
  syl: string
  /** Respelling for the card: "mis-TEER-ee-us". */
  say: string
  /** Difficulty 1.5 - 4.5. */
  d: number
  /** A = anchor (taught first), G = guided practice, P = transfer probe (held back). */
  role: 'A' | 'G' | 'P'
  /** The letters in this word that show the family's pattern, e.g. "mb" in lamb. */
  focus: string
  /** Start index of `focus`, when it is not the first occurrence. */
  focusAt?: number
  pos: 'noun' | 'verb' | 'adjective' | 'adverb'
  def: string
  sent: string
  /** Realistic misspellings, most likely first. */
  traps: string[]
  story: string
  /** Card: 2-3 emoji scene, a smaller word hiding inside, synonyms, silly sentence. */
  emoji: string
  hook: string
  syn: string[]
  card: string
  /** Why THIS word is spelled this way, when the family's general line would not make sense for it
   *  (shiny: "SHINE drops its silent E before the Y is added."). */
  why?: string
  /** Optional word-specific memory trick (otherwise the hook is used). */
  trick?: string
}

export interface CompactFamily {
  patternId: string
  /** Hidden label used by the engine and the parent report, never shown as a menu. */
  kind: string
  /** Kid-sized name. */
  title: string
  emoji: string
  kidRule: string
  /** Sound of the pattern, e.g. "/m/". */
  sound?: string
  /** First-miss nudge that does not give the letters away. */
  hint: string
  /** Second-miss reminder that does. */
  reminder: string
  /** Error bucket for this family's traps. */
  bucket?: ErrorBucket
  check: { question: string; correctAnswer: string; distractors: string[] }
  words: CompactWord[]
}

const ROLE = { A: 'ANCHOR', G: 'GUIDED', P: 'TRANSFER_PROBE' } as const

export function blank(sentence: string, word: string): string {
  return sentence.replace(new RegExp(`\\b${word}\\b`, 'i'), '_'.repeat(word.length))
}

function trapFor(word: string, misspelling: string, family: CompactFamily, trick: string): WordTrap {
  const mis = misspelling.toLowerCase()
  const length = Math.max(word.length, mis.length)
  let first = 0
  while (first < length && word[first] === mis[first]) first++
  const errorTileIndex = Math.min(first, word.length - 1)
  const diffs = [...word].filter((ch, i) => mis[i] !== ch).length
  const single = mis.length === word.length && diffs === 1
  return {
    misspelling: mis,
    bucket: family.bucket ?? 'PHONETIC_PATTERN_ERROR',
    errorTileIndex,
    ...(single ? { candidatePair: [word[first].toUpperCase(), mis[first].toUpperCase()] as [string, string] } : {}),
    judgeResponse: `Good try! ${family.reminder}`,
    memoryTrick: trick,
  }
}

export function expandFamily(family: CompactFamily): { pattern: PatternNode; words: BeeWord[]; cards: WordCard[] } {
  const words: BeeWord[] = family.words.map((c) => {
    const word = c.w.toLowerCase()
    const at = c.focusAt ?? word.indexOf(c.focus)
    const graphemeMap: GraphemeChunk[] = []
    for (let i = 0; i < word.length; ) {
      if (i === at && c.focus) {
        graphemeMap.push({
          grapheme: c.focus,
          phoneme: family.sound ?? '',
          startIndex: i,
          endIndex: i + c.focus.length - 1,
          isPatternFocus: true,
          coachingHint: family.hint,
        })
        i += c.focus.length
      } else {
        graphemeMap.push({ grapheme: word[i], phoneme: '', startIndex: i, endIndex: i })
        i += 1
      }
    }
    const trick = c.trick ?? `Look for “${c.hook}” hiding inside ${word.toUpperCase()}!`
    return {
      id: `word_${word}`,
      word,
      syllables: c.syl.split('-'),
      phoneticRespelling: c.say,
      difficulty: c.d,
      patternId: family.patternId,
      role: ROLE[c.role],
      meanings: [
        { partOfSpeech: c.pos, kidDefinition: c.def, exampleSentence: c.sent, blankedSentence: blank(c.sent, word) },
      ],
      graphemeMap,
      traps: c.traps.map((t) => trapFor(word, t, family, trick)),
      wordStory: c.story,
      ...(c.why ? { secret: c.why } : {}),
    }
  })

  const ids = (role: 'A' | 'G' | 'P') => family.words.filter((c) => c.role === role).map((c) => `word_${c.w.toLowerCase()}`)
  return {
    pattern: {
      patternId: family.patternId,
      title: family.title,
      badgeName: `${family.title} ${family.emoji}`,
      kidRule: family.kidRule,
      recognitionCheck: family.check,
      anchorWordIds: ids('A'),
      guidedWordIds: ids('G'),
      transferProbeIds: ids('P'),
      kind: family.kind,
      secret: family.reminder,
    },
    words,
    cards: family.words.map((c) => ({
      wordId: `word_${c.w.toLowerCase()}`,
      emoji: c.emoji,
      hook: c.hook,
      synonyms: c.syn,
      sentence: c.card,
    })),
  }
}
