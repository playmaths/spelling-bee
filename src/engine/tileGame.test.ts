import { describe, expect, it } from 'vitest'
import { TILE_DICTIONARY } from '../lib/tileWords.ts'
import {
  analyse,
  beeTurn,
  bonusAt,
  CENTER,
  emptyBoard,
  findMoves,
  hintMove,
  makeDictionary,
  newGame,
  playMove,
  RACK_SIZE,
  settle,
  swapTiles,
  type Board,
  type Placement,
} from './tileGame.ts'

const dict = makeDictionary(['cat', 'cats', 'at', 'car', 'cart', 'art', 'tar', 'star', 'so', 'as', 'to', 'toe', 'on', 'no', 'rat'], ['star'])
const across = (word: string, r: number, c: number): Placement[] => [...word].map((l, i) => ({ r, c: c + i, l: l.toUpperCase() }))
const withWord = (board: Board, placements: Placement[]): Board => {
  const b = board.map((row) => [...row])
  for (const p of placements) b[p.r][p.c] = p.l
  return b
}

describe('analyse: she is told how her letters stand before she plays', () => {
  it('says keep going while the letters are the start of a word', () => {
    const a = analyse(emptyBoard(), across('ca', CENTER, 2), dict)
    expect(a.state).toBe('PARTIAL')
    expect(a.message).toBe('CA… keep going.')
  })

  it('says so as soon as the letters cannot become a word', () => {
    const a = analyse(emptyBoard(), across('ct', CENTER, 2), dict)
    expect(a.state).toBe('INVALID')
    expect(a.message).toContain("I don't know a word that starts CT")
  })

  it('accepts a word and scores a point a letter', () => {
    const a = analyse(emptyBoard(), across('cat', CENTER, 2), dict)
    expect(a).toMatchObject({ state: 'VALID', score: 3 })
    expect(a.message).toBe('CAT is a word! 3 points.')
  })

  it('gives a little more for a word from her garden', () => {
    const a = analyse(emptyBoard(), across('star', CENTER, 1), dict)
    expect(a.score).toBe(4 + 2)
    expect(a.message).toContain('garden word')
  })

  it('explains where letters may go', () => {
    expect(analyse(emptyBoard(), across('cat', 0, 0), dict).message).toBe('The first word goes over the star.')
    expect(analyse(emptyBoard(), across('c', CENTER, 1), dict)).toMatchObject({ state: 'PARTIAL', message: 'C… keep going until the word crosses the star.' })
    expect(analyse(emptyBoard(), across('at', CENTER, 0), dict).state).toBe('PARTIAL')
    const board = withWord(emptyBoard(), across('cat', CENTER, 2))
    expect(analyse(board, across('so', 0, 0), dict).message).toBe('Join your letters to a word on the board.')
    expect(analyse(board, [{ r: 0, c: 0, l: 'S' }, { r: 1, c: 1, l: 'O' }], dict).message).toBe('Put your letters in one straight line.')
    expect(analyse(board, [{ r: 2, c: 2, l: 'S' }, { r: 2, c: 4, l: 'O' }], dict).message).toBe('Leave no gaps in your word.')
    expect(analyse(board, [{ r: CENTER, c: 2, l: 'S' }], dict).message).toBe('That square is taken.')
  })

  it('checks the words made the other way too', () => {
    const board = withWord(emptyBoard(), across('cat', CENTER, 2))
    // S on the end makes CATS.
    expect(analyse(board, [{ r: CENTER, c: 5, l: 'S' }], dict)).toMatchObject({ state: 'VALID', score: 4 })
    // ART down through the A.
    expect(analyse(board, [{ r: CENTER + 1, c: 3, l: 'R' }, { r: CENTER + 2, c: 3, l: 'T' }], dict)).toMatchObject({ state: 'VALID', score: 3 })
    // ON under CA makes CO and AN downwards, which are not words here.
    const bad = analyse(board, across('on', CENTER + 1, 2), dict)
    expect(bad.state).toBe('INVALID')
    expect(bad.message).toContain('also makes CO')
    // TO under AT: AT/TO stacked makes AT (down? no) -> both cross words must be real.
    const ok = analyse(board, across('so', CENTER + 1, 3), dict)
    expect(ok.state).toBe('VALID') // AS and TO downwards
    expect(ok.score).toBe(3 + 2 + 3) // the O sits on a flower square, so it counts double in SO and in TO
  })
})

describe('bonus squares', () => {
  it('a flower square doubles the letter put on it', () => {
    const board = withWord(emptyBoard(), across('cat', CENTER, 2))
    // ART down from the A: R lands on the flower square at row 4, column 3? No: (4,3) is plain, so 3 points.
    expect(analyse(board, [{ r: CENTER + 1, c: 3, l: 'R' }, { r: CENTER + 2, c: 3, l: 'T' }], dict).score).toBe(3)
    // TO down from the T: O lands on the flower square at (4,4).
    expect(bonusAt(4, 4)).toBe('LETTER')
    expect(analyse(board, [{ r: CENTER + 1, c: 4, l: 'O' }], dict).score).toBe(3)
  })

  it('a honey square doubles the whole word, once', () => {
    expect(bonusAt(5, 5)).toBe('WORD')
    const board = withWord(emptyBoard(), [{ r: 3, c: 5, l: 'C' }, { r: 4, c: 5, l: 'A' }])
    const a = analyse(board, [{ r: 5, c: 5, l: 'T' }], dict)
    expect(a.score).toBe(6)
    expect(a.message).toBe('CAT is a word! 6 points. Double word!')
    // Later, adding S under it does not double again.
    const later = withWord(board, [{ r: 5, c: 5, l: 'T' }])
    expect(analyse(later, [{ r: 6, c: 5, l: 'S' }], dict).score).toBe(4)
  })

  it('the board is the same from every side', () => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      expect(bonusAt(r, c)).toBe(bonusAt(c, r))
      expect(bonusAt(r, c)).toBe(bonusAt(6 - r, 6 - c))
    }
    expect(bonusAt(CENTER, CENTER)).toBeNull()
  })
})

describe('the game', () => {
  it('deals six letters each and starts with her', () => {
    const g = newGame(7)
    expect(g.racks.YOU).toHaveLength(RACK_SIZE)
    expect(g.racks.BEE).toHaveLength(RACK_SIZE)
    expect(g.bag.length + 12).toBe(43)
    expect(g.turn).toBe('YOU')
    expect(newGame(7)).toEqual(g)
    expect(newGame(8).racks).not.toEqual(g.racks)
  })

  it('a played word scores, refills the rack and passes the turn', () => {
    const g = { ...newGame(1), racks: { YOU: ['C', 'A', 'T', 'S', 'O', 'N'], BEE: ['R', 'A', 'T', 'E', 'S', 'O'] } }
    const after = playMove(g, 'YOU', across('cat', CENTER, 2), dict)
    expect(after.scores.YOU).toBe(3)
    expect(after.racks.YOU).toHaveLength(RACK_SIZE)
    expect(after.bag).toHaveLength(g.bag.length - 3)
    expect(after.turn).toBe('BEE')
    expect(after.last).toMatchObject({ by: 'YOU', words: ['CAT'], score: 3, kind: 'PLAY' })
  })

  it('refuses letters she does not hold, a non-word, or a move out of turn', () => {
    const g = { ...newGame(1), racks: { YOU: ['C', 'A', 'T', 'S', 'O', 'N'], BEE: ['R', 'A', 'T', 'E', 'S', 'O'] } }
    expect(playMove(g, 'YOU', across('rat', CENTER, 2), dict)).toBe(g)
    expect(playMove(g, 'YOU', across('cta', CENTER, 2), dict)).toBe(g)
    expect(playMove(g, 'BEE', across('rat', CENTER, 2), dict)).toBe(g)
  })

  it('swapping costs the turn and four quiet turns end the game', () => {
    let g = newGame(3)
    const before = [...g.racks.YOU]
    g = swapTiles(g, 'YOU')
    expect(g.turn).toBe('BEE')
    expect(g.racks.YOU).toHaveLength(RACK_SIZE)
    expect(g.bag.length).toBe(31)
    expect(g.racks.YOU.join('') === before.join('') && g.last?.kind === 'SWAP').toBe(false)
    g = swapTiles(g, 'BEE')
    g = swapTiles(g, 'YOU')
    expect(g.over).toBe(false)
    g = swapTiles(g, 'BEE')
    expect(g.over).toBe(true)
  })
})

describe('how a game ends', () => {
  const start = { ...newGame(1), racks: { YOU: ['C', 'A', 'T'], BEE: ['K', 'K', 'K'] }, bag: [] as string[] }

  it('ends when someone uses their last letter', () => {
    const g = playMove(start, 'YOU', across('cat', CENTER, 2), dict)
    expect(g).toMatchObject({ over: true, ended: 'OUT_OF_LETTERS' })
    expect(g.owners[CENTER][2]).toBe('YOU')
  })

  it('ends at a standstill: no word fits for either side and no letters are left to swap', () => {
    const board = withWord(emptyBoard(), across('cat', CENTER, 2))
    const stuck = { ...start, board, racks: { YOU: ['K', 'K'], BEE: ['K', 'K', 'K'] } }
    expect(settle(stuck, dict)).toMatchObject({ over: true, ended: 'STANDSTILL' })
    // Not a standstill while one side can still play, or can still take new letters.
    expect(settle({ ...stuck, racks: { YOU: ['S'], BEE: ['K'] } }, dict).over).toBe(false)
    expect(settle({ ...stuck, bag: ['A', 'T', 'S'] }, dict).over).toBe(false)
  })

  it('says why four quiet turns ended it', () => {
    let g = newGame(3)
    for (const p of ['YOU', 'BEE', 'YOU', 'BEE'] as const) g = swapTiles(g, p)
    expect(g.ended).toBe('QUIET')
  })
})

describe('finding moves', () => {
  it('finds every word a rack can make on the first turn, all over the star', () => {
    const moves = findMoves(emptyBoard(), ['C', 'A', 'T', 'S', 'O', 'N'], dict)
    expect(new Set(moves.map((m) => m.word))).toEqual(new Set(['CAT', 'CATS', 'AT', 'SO', 'AS', 'TO', 'ON', 'NO']))
    for (const m of moves) expect(m.placements.some((p) => p.r === CENTER && p.c === CENTER)).toBe(true)
  })

  it('builds on the board and never offers a move the rules refuse', () => {
    const board = withWord(emptyBoard(), across('cat', CENTER, 2))
    const moves = findMoves(board, ['S', 'R', 'O', 'T', 'A', 'E'], dict)
    expect(moves.map((m) => m.word)).toContain('CATS')
    expect(moves.map((m) => m.word)).toContain('ART')
    for (const m of moves) expect(analyse(board, m.placements, dict).state).toBe('VALID')
  })

  it('gives a hint she can actually play', () => {
    const g = { ...newGame(1), racks: { YOU: ['C', 'A', 'T', 'S', 'O', 'N'], BEE: ['R', 'A', 'T', 'E', 'S', 'O'] } }
    const hint = hintMove(g, dict)!
    expect(playMove(g, 'YOU', hint.placements, dict).scores.YOU).toBeGreaterThan(0)
    expect(hintMove({ ...g, racks: { ...g.racks, YOU: ['K', 'K', 'K', 'K', 'K', 'K'] } }, dict)).toBeNull()
  })
})

describe('whole games with the real word book', () => {
  it.each([1, 2, 3, 4, 5, 6])('game %i: the bee and a hint-following player finish a fair game', (seed) => {
    let g = newGame(seed)
    for (let turn = 0; turn < 80 && !g.over; turn++) {
      if (g.turn === 'YOU') {
        const hint = hintMove(g, TILE_DICTIONARY)
        g = hint ? playMove(g, 'YOU', hint.placements, TILE_DICTIONARY) : swapTiles(g, 'YOU')
      } else {
        g = beeTurn(g, TILE_DICTIONARY)
      }
      g = settle(g, TILE_DICTIONARY)
    }
    expect(g.over).toBe(true)
    expect(g.ended).toBeDefined()
    // Every letter on the board belongs to whoever played it.
    g.board.forEach((row, r) => row.forEach((cell, c) => expect(!!cell).toBe(!!g.owners[r][c])))
    expect(g.scores.YOU + g.scores.BEE).toBeGreaterThan(20)
    // Every run of two or more letters on the finished board is a real word.
    const lines = [...g.board.map((row) => row.map((c) => c ?? ' ').join('')), ...g.board[0].map((_, c) => g.board.map((row) => row[c] ?? ' ').join(''))]
    for (const line of lines) for (const run of line.split(' ').filter((x) => x.length >= 2)) expect(TILE_DICTIONARY.has(run), run).toBe(true)
  })

  it('the bee is quick enough to play on a phone', () => {
    const g = { ...newGame(9), turn: 'BEE' as const }
    const began = performance.now()
    beeTurn(g, TILE_DICTIONARY)
    expect(performance.now() - began).toBeLessThan(1500)
  })
})
