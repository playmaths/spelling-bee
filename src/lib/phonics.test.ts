import { describe, expect, it } from 'vitest'
import { WORDS, getWord } from '../data/index.ts'
import { phonicsChunks, visualTips } from './phonics.ts'

const split = (id: string) => phonicsChunks(getWord(`word_${id}`)!).map((c) => c.text).join(' – ')

describe('phonics chunks', () => {
  it('splits stretch into str – e – tch, with a blend and a team', () => {
    const chunks = phonicsChunks(getWord('word_stretch')!)
    expect(chunks.map((c) => c.text)).toEqual(['str', 'e', 'tch'])
    expect(chunks.map((c) => c.kind)).toEqual(['BLEND', 'LETTER', 'TEAM'])
    expect(visualTips(chunks)).toEqual([
      'Underline S-T-R. You can hear each letter, said quickly together.',
      'Circle T-C-H. These 3 letters work as a team.',
    ])
  })

  it.each([
    ['knight', 'kn – igh – t'],
    ['explain', 'e – x – pl – ai – n'],
    ['question', 'qu – e – s – tion'],
    ['planning', 'pl – a – nn – i – ng'],
    ['mysterious', 'm – y – s – t – e – r – i – ous'],
  ])('%s -> %s', (word, expected) => {
    expect(split(word)).toBe(expected)
  })

  it('never pairs letters across a syllable break', () => {
    // up-right: the P ends one beat and the R starts the next, so they are not a blend.
    expect(split('upright')).toBe('u – p – r – igh – t')
  })

  it.each(WORDS.map((w) => [w.word, w] as const))('%s: chunks rebuild the word and keep its tricky part whole', (_, w) => {
    const chunks = phonicsChunks(w)
    expect(chunks.map((c) => c.text).join('')).toBe(w.word)
    const focus = w.graphemeMap.find((c) => c.isPatternFocus)!
    expect(chunks.filter((c) => c.focus).map((c) => c.text)).toEqual([focus.grapheme])
    expect(visualTips(chunks).length).toBeLessThanOrEqual(2)
  })
})
