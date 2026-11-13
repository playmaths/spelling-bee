import { describe, expect, it } from 'vitest'
import { getWord } from '../data/index.ts'
import { isSpelledOut, parseSpokenLetters, readChunk, spelledAlternatives, verifyDictation } from './speechVerifier.ts'

const practice = getWord('word_practice')!
const sentence = getWord('word_sentence')!

describe('parseSpokenLetters', () => {
  it.each([
    ['bee see why are you', 'BCYRU'],
    ['double u r i t e', 'WRITE'],
    ['r a double b i t', 'RABBIT'],
    ['M Y S T E R I O U S', 'MYSTERIOUS'],
    ['mys t e r i o u s', 'MYSTERIOUS'],
    ['capital K. N. O. W.', 'KNOW'],
  ])('%s -> %s', (said, letters) => {
    expect(parseSpokenLetters(said).join('')).toBe(letters)
  })
})

describe('verifyDictation', () => {
  it('flags a rhyming mishearing as ASR_SUSPECT, never as a spelling error', () => {
    // "T" heard for "P": same E-set, and nobody spells practice with a T.
    const tiles = verifyDictation(practice, ['t r a c t i c e'])
    expect(tiles[0]).toMatchObject({ letter: 'T', isAsrSuspect: true })
    expect(tiles.slice(1).every((t) => !t.isAsrSuspect)).toBe(true)
  })

  it('flags a tile when the target appears among the N-best alternatives, without auto-correcting it', () => {
    const tiles = verifyDictation(practice, ['p r a c t i c l', 'p r a c t i c e'])
    expect(tiles[7]).toMatchObject({ letter: 'L', alternatives: ['E'], isAsrSuspect: true })
  })

  it('does not excuse a known phonetic trap, even inside a rhyme group', () => {
    // sentenSe: S for C is the authored trap, a real spelling error.
    const tiles = verifyDictation(sentence, ['s e n t e n s e'])
    expect(tiles.some((t) => t.isAsrSuspect)).toBe(false)
    const twin = verifyDictation(practice, ['p r a c t i s e'])
    expect(twin.some((t) => t.isAsrSuspect)).toBe(false)
  })

  it('leaves a correct dictation clean', () => {
    expect(verifyDictation(practice, ['p r a c t i c e']).some((t) => t.isAsrSuspect)).toBe(false)
  })
})

describe('saying the word is not spelling it', () => {
  it.each(['r h i n o', 'R. H. I. N. O.', 'are aitch eye en oh', 'double u r i t e', 'capital K n o w'])('accepts %s', (t) => {
    expect(isSpelledOut(t)).toBe(true)
  })

  it.each(['rhino', 'Rhino.', 'the rhino', 'r h ino', ''])('rejects %j', (t) => {
    expect(isSpelledOut(t)).toBe(false)
  })

  it('uses a spelled alternative when the best guess was the whole word', () => {
    expect(spelledAlternatives(['rhino', 'r h i n o', 'rhinos'])).toEqual(['r h i n o'])
    expect(spelledAlternatives(['rhino', 'rhinos'])).toEqual([])
  })
})

describe('readChunk: letters or a word?', () => {
  it('refuses a quickly spoken word', () => {
    expect(readChunk(['rhino', 'rhinos'], 700)).toEqual({ kind: 'WORD' })
  })

  it('accepts the same transcript when it took long enough to have been spelled', () => {
    // The browser tidied "R, H, I, N, O" into "rhino"; five letters need about 1.5 seconds.
    expect(readChunk(['rhino'], 2600)).toEqual({ kind: 'LETTERS', transcripts: ['rhino'] })
  })

  it('accepts letter-by-letter readings at any speed, and prefers them', () => {
    expect(readChunk(['rhino', 'r h i n o'], 400)).toEqual({ kind: 'LETTERS', transcripts: ['r h i n o'] })
    expect(readChunk(['are aitch'], 300)).toEqual({ kind: 'LETTERS', transcripts: ['are aitch'] })
  })

  it('accepts a letter or two said together, and anything when timing is unknown', () => {
    expect(readChunk(['no'], 200).kind).toBe('LETTERS')
    expect(readChunk(['rhino'], null).kind).toBe('LETTERS')
  })

  it('reports silence', () => {
    expect(readChunk(['', ' '], 900)).toEqual({ kind: 'NOTHING' })
  })
})

describe('letters arriving a few at a time', () => {
  it('checks each new letter against the right tile', () => {
    const tiles = verifyDictation(practice, ['t i c e'], 4)
    expect(tiles.map((t) => t.index)).toEqual([4, 5, 6, 7])
    expect(tiles.some((t) => t.isAsrSuspect)).toBe(false)
    expect(verifyDictation(practice, ['d'], 4)[0]).toMatchObject({ index: 4, letter: 'D', isAsrSuspect: true })
  })
})


describe('confirming a fuzzy letter', () => {
  it('offers at most four letters, including the heard one and the one the word needs', async () => {
    const { fuzzyChoices } = await import('./SpellEntry.tsx')
    const choices = fuzzyChoices({ index: 1, letter: 'T', alternatives: [], isAsrSuspect: true }, 'needle')
    expect(choices).toHaveLength(4)
    expect(choices).toContain('T')
    expect(choices).toContain('E')
    expect(choices).toEqual([...choices].sort())
  })
})
