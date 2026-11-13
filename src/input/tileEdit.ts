/**
 * Editing the row of letter tiles in place. With nothing selected a new letter
 * goes on the end; with a tile selected it replaces that tile, or (after "Add a
 * letter here") slips in before it. Deleting a tile closes the gap.
 */
export type Selection = { index: number; insert: boolean } | null

export function enterLetter(letters: string, letter: string, sel: Selection): string {
  if (!sel || sel.index >= letters.length) return letters + letter
  return sel.insert
    ? letters.slice(0, sel.index) + letter + letters.slice(sel.index)
    : letters.slice(0, sel.index) + letter + letters.slice(sel.index + 1)
}

export function deleteTile(letters: string, index: number): string {
  return index < 0 || index >= letters.length ? letters : letters.slice(0, index) + letters.slice(index + 1)
}

/** Keeps "the microphone was fuzzy here" markers pointing at the right tiles after an edit. */
export function shiftMarks<T extends { index: number }>(
  marks: readonly T[],
  edit: { kind: 'REPLACE' | 'DELETE' | 'INSERT'; index: number },
): T[] {
  if (edit.kind === 'REPLACE') return marks.filter((m) => m.index !== edit.index)
  if (edit.kind === 'DELETE') {
    return marks.filter((m) => m.index !== edit.index).map((m) => (m.index > edit.index ? { ...m, index: m.index - 1 } : m))
  }
  return marks.map((m) => (m.index >= edit.index ? { ...m, index: m.index + 1 } : m))
}
