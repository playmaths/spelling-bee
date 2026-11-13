import { describe, expect, it } from 'vitest'
import { getWord } from '../data/index.ts'
import { parseSpokenLetters, verifyDictation } from './speechVerifier.ts'

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
