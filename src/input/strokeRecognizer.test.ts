import { describe, expect, it } from 'vitest'
import { recognize, templatesFor, type Stroke } from './strokeRecognizer.ts'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Deterministic wobble: turns a clean template into something hand-drawn-ish. */
function wobble(strokes: Stroke[], seed: number): Stroke[] {
  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5) * 2
  const angle = rnd() * 0.12
  const sx = 180 + rnd() * 40
  const sy = 200 + rnd() * 40
  return strokes.map((stroke) => {
    // Each stroke lands a little off, as when a pen is lifted and put down again.
    const ox = rnd() * 7
    const oy = rnd() * 7
    const dense: Stroke = []
    for (let i = 1; i < stroke.length; i++) {
      for (let t = 0; t < 1; t += 0.2) {
        dense.push([
          stroke[i - 1][0] + t * (stroke[i][0] - stroke[i - 1][0]),
          stroke[i - 1][1] + t * (stroke[i][1] - stroke[i - 1][1]),
        ])
      }
    }
    dense.push(stroke[stroke.length - 1])
    return dense.map(([x, y]) => {
      const rx = x * Math.cos(angle) - y * Math.sin(angle)
      const ry = x * Math.sin(angle) + y * Math.cos(angle)
      return [40 + rx * sx + ox + rnd() * 1.5, 30 + ry * sy + oy + rnd() * 1.5]
    })
  })
}

describe('recognize', () => {
  it.each(ALPHABET)('recognises a wobbly %s in its top two guesses', (letter) => {
    templatesFor(letter).forEach((template, v) => {
      for (const seed of [7, 99, 1234]) {
        const top = recognize(wobble(template, seed + v)).slice(0, 2).map((g) => g.letter)
        expect(top, `${letter} variant ${v} seed ${seed}`).toContain(letter)
      }
    })
  })

  it.each([
    ['I', ['I', 'Y']],
    ['Y', ['I', 'Y']],
    ['C', ['C', 'S']],
    ['S', ['C', 'S']],
    ['K', ['G', 'K', 'W']],
    ['W', ['G', 'K', 'W']],
    ['E', ['A', 'E']],
    ['A', ['A', 'I']],
    ['Z', ['S', 'Z']],
    ['U', ['E', 'U']],
  ])('picks %s out of a puzzle gap offering %j', (letter, candidates) => {
    templatesFor(letter).forEach((template, v) => {
      expect(recognize(wobble(template, 42 + v), candidates)[0].letter).toBe(letter)
    })
  })

  it('ignores stroke order and direction', () => {
    const [t] = templatesFor('T')
    const flipped = [...t].reverse().map((s) => [...s].reverse())
    expect(recognize(wobble(flipped, 5))[0].letter).toBe('T')
  })

  it('returns nothing for an empty pad', () => {
    expect(recognize([])).toEqual([])
  })
})
