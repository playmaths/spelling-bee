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
export function verifyDictation(word: BeeWord, nBest: readonly string[]): HeardTile[] {
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
    const expected = target[index]
    const knownTrap = word.traps.some((t) => t.misspelling[index]?.toUpperCase() === letter)
    const isAsrSuspect =
      expected !== undefined &&
      letter !== expected &&
      !knownTrap &&
      (alternatives.includes(expected) || sameAcousticGroup(letter, expected))
    return { index, letter, alternatives, isAsrSuspect }
  })
}
