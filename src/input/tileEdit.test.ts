import { describe, expect, it } from 'vitest'
import { deleteTile, enterLetter, shiftMarks } from './tileEdit.ts'

describe('editing tiles in place', () => {
  it('fixes ARRYVING into ARRIVING by changing one tile', () => {
    expect(enterLetter('ARRYVING', 'I', { index: 3, insert: false })).toBe('ARRIVING')
  })

  it('deletes an extra letter and closes the gap', () => {
    expect(deleteTile('ARRRIVING', 2)).toBe('ARRIVING')
  })

  it('adds a missing letter before the selected tile', () => {
    expect(enterLetter('ARRVING', 'I', { index: 3, insert: true })).toBe('ARRIVING')
  })

  it('adds to the end when nothing is selected', () => {
    expect(enterLetter('ARRIVIN', 'G', null)).toBe('ARRIVING')
  })

  it('keeps fuzzy-letter markers on the right tiles', () => {
    const marks = [{ index: 1 }, { index: 4 }]
    expect(shiftMarks(marks, { kind: 'DELETE', index: 2 })).toEqual([{ index: 1 }, { index: 3 }])
    expect(shiftMarks(marks, { kind: 'INSERT', index: 2 })).toEqual([{ index: 1 }, { index: 5 }])
    expect(shiftMarks(marks, { kind: 'REPLACE', index: 4 })).toEqual([{ index: 1 }])
  })
})
