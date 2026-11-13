import type { BeeWord } from '../types/game.ts'

/**
 * Contract 1 — Speech Recognition vs. True Spelling Error.
 * Turns browser speech transcripts into letters and decides which tiles the
 * microphone probably misheard. Never auto-corrects a letter to the target.
 */

export const ACOUSTIC_CONFUSION_GROUPS: readonly string[][] = [
  ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  ['A', 'J', 'K'],
  ['M', 'N'],
  ['F', 'S', 'X'],
]

/** Words a recogniser writes when it hears a letter name. */
const LETTER_WORDS: Record<string, string> = {
  ay: 'A', hey: 'A', eh: 'A',
  bee: 'B', be: 'B',
  see: 'C', sea: 'C', si: 'C',
  dee: 'D',
  ee: 'E',
  ef: 'F', eff: 'F',
  gee: 'G', jee: 'G',
  aitch: 'H', age: 'H', each: 'H',
  eye: 'I', aye: 'I',
  jay: 'J',
  kay: 'K', okay: 'K',
  el: 'L', elle: 'L', ell: 'L',
  em: 'M',
  en: 'N', and: 'N', in: 'N',
  oh: 'O', owe: 'O',
  pee: 'P', pea: 'P',
  cue: 'Q', queue: 'Q',
  are: 'R', ar: 'R', our: 'R',
  ess: 'S', as: 'S',
  tee: 'T', tea: 'T',
  you: 'U', ewe: 'U',
  vee: 'V',
  ex: 'X', eggs: 'X',
  why: 'Y',
  zee: 'Z', zed: 'Z',
}

/** "double u" -> W, "double t" -> TT, "bee" -> B, "mys" -> M, Y, S. */
export function parseSpokenLetters(transcript: string): string[] {
  const tokens = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const letters: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === 'capital') continue
    if (token === 'double' && tokens[i + 1]) {
      const next = tokens[i + 1]
      if (next === 'u' || next === 'you') letters.push('W')
      else {
        const letter = next.length === 1 ? next.toUpperCase() : LETTER_WORDS[next]
        if (letter) letters.push(letter, letter)
        else continue
      }
      i++
      continue
    }
    if (token.length === 1) letters.push(token.toUpperCase())
    else if (LETTER_WORDS[token]) letters.push(LETTER_WORDS[token])
    // Recognisers often glue spelled letters together ("m y s" -> "mys").
    else letters.push(...token.toUpperCase())
  }
  return letters
}

/**
 * True when the transcript is letters being spelled out ("r h i n o", "bee see",
 * "double u"), not a word being said ("rhino"). Saying the word is not spelling it.
 */
export function isSpelledOut(transcript: string): boolean {
  const tokens = transcript
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t !== 'capital' && t !== 'double')
  return tokens.length > 0 && tokens.every((t) => t.length === 1 || LETTER_WORDS[t] !== undefined)
}

/** Keeps only the alternatives in which she actually spelled, best first. */
export function spelledAlternatives(nBest: readonly string[]): string[] {
  return nBest.filter(isSpelledOut)
}

export function sameAcousticGroup(a: string, b: string): boolean {
  return a !== b && ACOUSTIC_CONFUSION_GROUPS.some((g) => g.includes(a) && g.includes(b))
}

export function acousticGroupOf(letter: string): string[] {
  return ACOUSTIC_CONFUSION_GROUPS.find((g) => g.includes(letter)) ?? [letter]
}

export interface HeardTile {
  index: number
  letter: string
  /** Other letters the recogniser offered for this position. */
  alternatives: string[]
  isAsrSuspect: boolean
}

/**
 * @param nBest transcripts, best first (SpeechRecognition with maxAlternatives = 5).
 * A tile is ASR_SUSPECT when the top letter is not the target and either the target
 * shows up among the alternatives, or the top letter merely rhymes with the target,
 * unless that letter is a known phonetic trap for this word (then it is a real error).
 */
export function verifyDictation(word: BeeWord, nBest: readonly string[], offset = 0): HeardTile[] {
  const parses = nBest.slice(0, 5).map(parseSpokenLetters)
  const top = parses[0] ?? []
  const target = word.word.toUpperCase()

  return top.map((letter, index) => {
    const alternatives = [
      ...new Set(
        parses
          .slice(1)
          .filter((p) => p.length === top.length)
          .map((p) => p[index])
          .filter((l) => l && l !== letter),
      ),
    ]
    // `offset` = tiles already filled, when letters arrive a few at a time.
    const expected = target[index + offset]
    const knownTrap = word.traps.some((t) => t.misspelling[index + offset]?.toUpperCase() === letter)
    const isAsrSuspect =
      expected !== undefined &&
      letter !== expected &&
      !knownTrap &&
      (alternatives.includes(expected) || sameAcousticGroup(letter, expected))
    return { index: index + offset, letter, alternatives, isAsrSuspect }
  })
}

/** Roughly the fastest a child can say one letter name, in milliseconds. */
export const MS_PER_LETTER = 300

export type HeardChunk =
  | { kind: 'LETTERS'; transcripts: string[] }
  | { kind: 'WORD' } // she said a word instead of spelling
  | { kind: 'NOTHING' }

/**
 * Decides whether one burst of speech was letters or a whole word.
 *
 * Browsers often tidy spelled letters into a word ("R, H, I, N, O" comes back as
 * "rhino"), so the transcript alone cannot tell. What can: spelling takes time.
 * A burst is accepted as letters when the recogniser offers a letter-by-letter
 * reading, when it is only a letter or two, or when it lasted long enough for
 * that many letters to have been said one by one. A quick multi-letter burst is a word.
 * With no timing available the burst is accepted, because refusing real spelling is worse.
 */
export function readChunk(nBest: readonly string[], elapsedMs: number | null): HeardChunk {
  const heard = nBest.filter((t) => t.trim() !== '')
  if (heard.length === 0) return { kind: 'NOTHING' }
  const spelled = spelledAlternatives(heard)
  if (spelled.length > 0) return { kind: 'LETTERS', transcripts: spelled }
  const letters = parseSpokenLetters(heard[0])
  if (letters.length === 0) return { kind: 'NOTHING' }
  if (letters.length <= 2 || elapsedMs === null || elapsedMs >= MS_PER_LETTER * letters.length) {
    return { kind: 'LETTERS', transcripts: [...heard] }
  }
  return { kind: 'WORD' }
}

