/**
 * Bee tiles: a small crossword-tile game against the bee (7 x 7 board, six letters each).
 * Pure functions, like the Judge and the puzzle engine: the screen only draws the state.
 * Scoring is light on purpose: one point a letter, plus a little for a word from her own garden.
 */

export const SIZE = 7
export const CENTER = 3
export const RACK_SIZE = 6
export const GARDEN_BONUS = 2

export type Board = (string | null)[][]
export interface Placement {
  r: number
  c: number
  /** Upper-case letter. */
  l: string
}
export interface FoundWord {
  text: string
  cells: [number, number][]
  valid: boolean
  /** A word from the spelling bank: worth a little more. */
  garden: boolean
}
/**
 * How the letters she has put down stand right now, before she plays them:
 * VALID can be played; PARTIAL is the start of a word (keep going); INVALID cannot
 * become a word; LAYOUT means the letters are in the wrong place.
 */
export type MoveState = 'EMPTY' | 'VALID' | 'PARTIAL' | 'INVALID' | 'LAYOUT'
export interface Analysis {
  state: MoveState
  main: FoundWord | null
  words: FoundWord[]
  score: number
  message: string
}

export interface Dictionary {
  words: string[]
  has: (word: string) => boolean
  /** True if some word starts with these letters. */
  starts: (letters: string) => boolean
  garden: (word: string) => boolean
}

export function makeDictionary(words: readonly string[], gardenWords: readonly string[] = []): Dictionary {
  const all = [...new Set([...words, ...gardenWords].map((w) => w.toUpperCase()))].filter((w) => w.length >= 2 && w.length <= SIZE)
  const set = new Set(all)
  const starts = new Set<string>()
  for (const w of all) for (let i = 1; i <= w.length; i++) starts.add(w.slice(0, i))
  const garden = new Set(gardenWords.map((w) => w.toUpperCase()))
  return { words: all, has: (w) => set.has(w.toUpperCase()), starts: (w) => starts.has(w.toUpperCase()), garden: (w) => garden.has(w.toUpperCase()) }
}

export const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null))
const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < SIZE && c < SIZE
const isEmptyBoard = (board: Board) => board.every((row) => row.every((cell) => cell === null))

type Dir = 'ACROSS' | 'DOWN'
const step = (dir: Dir): [number, number] => (dir === 'ACROSS' ? [0, 1] : [1, 0])

/** The whole run of letters through (r, c) in one direction. */
function runAt(board: Board, r: number, c: number, dir: Dir): { text: string; cells: [number, number][] } {
  const [dr, dc] = step(dir)
  while (inside(r - dr, c - dc) && board[r - dr][c - dc]) {
    r -= dr
    c -= dc
  }
  const cells: [number, number][] = []
  let text = ''
  while (inside(r, c) && board[r][c]) {
    cells.push([r, c])
    text += board[r][c]
    r += dr
    c += dc
  }
  return { text, cells }
}

const layout = (message: string): Analysis => ({ state: 'LAYOUT', main: null, words: [], score: 0, message })

/** Looks at the letters she has put down (not yet played) and says how they stand. */
export function analyse(board: Board, placements: readonly Placement[], dict: Dictionary): Analysis {
  if (placements.length === 0) return { state: 'EMPTY', main: null, words: [], score: 0, message: 'Tap a square, then tap your letters.' }
  const seen = new Set<string>()
  for (const p of placements) {
    if (!inside(p.r, p.c) || board[p.r][p.c] || seen.has(`${p.r},${p.c}`)) return layout('That square is taken.')
    seen.add(`${p.r},${p.c}`)
  }
  const rows = new Set(placements.map((p) => p.r))
  const cols = new Set(placements.map((p) => p.c))
  if (rows.size > 1 && cols.size > 1) return layout('Put your letters in one straight line.')

  const temp = board.map((row) => [...row])
  for (const p of placements) temp[p.r][p.c] = p.l.toUpperCase()

  let dir: Dir
  if (placements.length === 1) {
    const { r, c } = placements[0]
    dir = runAt(temp, r, c, 'DOWN').text.length > runAt(temp, r, c, 'ACROSS').text.length ? 'DOWN' : 'ACROSS'
  } else {
    dir = rows.size === 1 ? 'ACROSS' : 'DOWN'
    const along = placements.map((p) => (dir === 'ACROSS' ? p.c : p.r))
    for (let i = Math.min(...along); i <= Math.max(...along); i++) {
      const cell = dir === 'ACROSS' ? temp[placements[0].r][i] : temp[i][placements[0].c]
      if (!cell) return layout('Leave no gaps in your word.')
    }
  }
  const other: Dir = dir === 'ACROSS' ? 'DOWN' : 'ACROSS'
  const word = (run: { text: string; cells: [number, number][] }): FoundWord => ({
    ...run,
    valid: dict.has(run.text),
    garden: dict.garden(run.text),
  })
  const main = word(runAt(temp, placements[0].r, placements[0].c, dir))
  const crosses = placements.map((p) => runAt(temp, p.r, p.c, other)).filter((run) => run.text.length >= 2).map(word)

  if (isEmptyBoard(board)) {
    if (!main.cells.some(([r, c]) => r === CENTER && c === CENTER)) {
      // Still on its way to the star: say so gently instead of calling it wrong.
      const heading =
        placements.length === 1 ? placements[0].r === CENTER || placements[0].c === CENTER : dir === 'ACROSS' ? placements[0].r === CENTER : placements[0].c === CENTER
      if (heading && (main.valid || dict.starts(main.text))) {
        return { state: 'PARTIAL', main, words: [main], score: 0, message: `${main.text}… keep going until the word crosses the star.` }
      }
      return layout('The first word goes over the star.')
    }
  } else if (main.cells.length === placements.length && crosses.length === 0) {
    return layout('Join your letters to a word on the board.')
  }
  if (main.text.length < 2) return { state: 'PARTIAL', main, words: [main], score: 0, message: 'Keep going. Add another letter.' }

  const words = [main, ...crosses]
  const badCross = crosses.find((w) => !w.valid)
  if (badCross) {
    const lead = main.valid ? `${main.text} is a word, but it` : 'That'
    return { state: 'INVALID', main, words, score: 0, message: `${lead} also makes ${badCross.text}, which is not in my word book.` }
  }
  if (!main.valid) {
    return dict.starts(main.text)
      ? { state: 'PARTIAL', main, words, score: 0, message: `${main.text}… keep going.` }
      : { state: 'INVALID', main, words, score: 0, message: `I don't know a word that starts ${main.text}.` }
  }
  const score = words.reduce((sum, w) => sum + w.text.length + (w.garden ? GARDEN_BONUS : 0), 0)
  const extra = words.some((w) => w.garden) ? ' A garden word!' : ''
  return { state: 'VALID', main, words, score, message: `${main.text} is a word! ${score} points.${extra}` }
}

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

export type Player = 'YOU' | 'BEE'
export interface LastMove {
  by: Player
  cells: [number, number][]
  words: string[]
  score: number
  /** 'PLAY', or a turn with no word. */
  kind: 'PLAY' | 'SWAP' | 'SKIP'
}
export interface TileState {
  board: Board
  bag: string[]
  racks: Record<Player, string[]>
  scores: Record<Player, number>
  turn: Player
  last: LastMove | null
  /** Turns in a row with no word; four ends the game. */
  quiet: number
  over: boolean
  seed: number
}

/** Plenty of vowels and friendly consonants; no Q, X, Z, J or V. */
const TILES: Record<string, number> = {
  E: 5, A: 4, I: 3, O: 3, U: 2,
  T: 3, R: 3, S: 3, N: 2, L: 2, D: 2, P: 2,
  G: 1, H: 1, M: 1, B: 1, C: 1, F: 1, K: 1, W: 1, Y: 1,
}

function nextRandom(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) >>> 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s]
}

function shuffled<T>(items: readonly T[], seed: number): [T[], number] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    let x: number
    ;[x, seed] = nextRandom(seed)
    const j = Math.floor(x * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return [out, seed]
}

export function newGame(seed: number): TileState {
  const all = Object.entries(TILES).flatMap(([letter, n]) => Array<string>(n).fill(letter))
  const [bag, next] = shuffled(all, seed >>> 0)
  return {
    board: emptyBoard(),
    racks: { YOU: bag.slice(0, RACK_SIZE), BEE: bag.slice(RACK_SIZE, RACK_SIZE * 2) },
    bag: bag.slice(RACK_SIZE * 2),
    scores: { YOU: 0, BEE: 0 },
    turn: 'YOU',
    last: null,
    quiet: 0,
    over: false,
    seed: next,
  }
}

const otherPlayer = (p: Player): Player => (p === 'YOU' ? 'BEE' : 'YOU')

/** Takes letters out of a rack; null if the rack does not hold them. */
function without(rack: readonly string[], letters: readonly string[]): string[] | null {
  const left = [...rack]
  for (const l of letters) {
    const at = left.indexOf(l)
    if (at < 0) return null
    left.splice(at, 1)
  }
  return left
}

/** Plays letters that make a word. Returns the same state if the move is not allowed. */
export function playMove(state: TileState, by: Player, placements: readonly Placement[], dict: Dictionary): TileState {
  if (state.over || state.turn !== by) return state
  const a = analyse(state.board, placements, dict)
  const kept = without(state.racks[by], placements.map((p) => p.l.toUpperCase()))
  if (a.state !== 'VALID' || !kept) return state
  const board = state.board.map((row) => [...row])
  for (const p of placements) board[p.r][p.c] = p.l.toUpperCase()
  const draw = Math.min(RACK_SIZE - kept.length, state.bag.length)
  const rack = [...kept, ...state.bag.slice(0, draw)]
  const bag = state.bag.slice(draw)
  return {
    ...state,
    board,
    bag,
    racks: { ...state.racks, [by]: rack },
    scores: { ...state.scores, [by]: state.scores[by] + a.score },
    turn: otherPlayer(by),
    last: { by, cells: placements.map((p) => [p.r, p.c]), words: a.words.map((w) => w.text), score: a.score, kind: 'PLAY' },
    quiet: 0,
    over: rack.length === 0,
  }
}

/** Swaps the whole rack for new letters (or skips the turn when the bag is nearly empty). */
export function swapTiles(state: TileState, by: Player): TileState {
  if (state.over || state.turn !== by) return state
  const rack = state.racks[by]
  const quiet = state.quiet + 1
  const base = { ...state, turn: otherPlayer(by), quiet, over: quiet >= 4 }
  if (state.bag.length < rack.length) return { ...base, last: { by, cells: [], words: [], score: 0, kind: 'SKIP' } }
  const [mixed, seed] = shuffled([...state.bag, ...rack], state.seed)
  return {
    ...base,
    seed,
    racks: { ...state.racks, [by]: mixed.slice(0, rack.length) },
    bag: mixed.slice(rack.length),
    last: { by, cells: [], words: [], score: 0, kind: 'SWAP' },
  }
}

export interface Move {
  placements: Placement[]
  word: string
  score: number
}

/** Every word that can be played from a rack. */
export function findMoves(board: Board, rack: readonly string[], dict: Dictionary): Move[] {
  const moves: Move[] = []
  const first = isEmptyBoard(board)
  const have: Record<string, number> = {}
  for (const l of rack) have[l] = (have[l] ?? 0) + 1
  const near = (r: number, c: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => inside(r + dr, c + dc) && board[r + dr][c + dc])

  for (const word of dict.words) {
    for (const dir of ['ACROSS', 'DOWN'] as const) {
      const [dr, dc] = step(dir)
      for (let line = 0; line < SIZE; line++) {
        if (first && line !== CENTER) continue
        for (let start = 0; start + word.length <= SIZE; start++) {
          const r0 = dir === 'ACROSS' ? line : start
          const c0 = dir === 'ACROSS' ? start : line
          if (inside(r0 - dr, c0 - dc) && board[r0 - dr][c0 - dc]) continue
          const rEnd = r0 + dr * word.length
          const cEnd = c0 + dc * word.length
          if (inside(rEnd, cEnd) && board[rEnd][cEnd]) continue
          const placements: Placement[] = []
          const need: Record<string, number> = {}
          let fits = true
          let touches = false
          for (let i = 0; i < word.length && fits; i++) {
            const r = r0 + dr * i
            const c = c0 + dc * i
            const cell = board[r][c]
            if (cell) {
              if (cell !== word[i]) fits = false
              touches = true
            } else {
              need[word[i]] = (need[word[i]] ?? 0) + 1
              if (need[word[i]] > (have[word[i]] ?? 0)) fits = false
              else {
                placements.push({ r, c, l: word[i] })
                touches ||= near(r, c)
              }
            }
          }
          if (!fits || placements.length === 0 || (!first && !touches)) continue
          const a = analyse(board, placements, dict)
          if (a.state === 'VALID' && a.main?.text === word) moves.push({ placements, word, score: a.score })
        }
      }
    }
  }
  return moves
}

/**
 * The bee plays at her level, not to win: it picks from the middle of what it could
 * play, eases off when it is ahead and tries a bit harder when it is behind.
 */
export function chooseBeeMove(state: TileState, dict: Dictionary): { move: Move | null; seed: number } {
  const moves = findMoves(state.board, state.racks.BEE, dict).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
  if (moves.length === 0) return { move: null, seed: state.seed }
  const lead = state.scores.BEE - state.scores.YOU
  const n = moves.length
  const [from, to] = lead >= 4 ? [Math.floor(n / 2), n] : lead <= -4 ? [0, Math.ceil(n / 3)] : [Math.floor(n / 4), Math.ceil((n * 3) / 4)]
  const [x, seed] = nextRandom(state.seed)
  return { move: moves[from + Math.floor(x * Math.max(1, to - from))] ?? moves[0], seed }
}

export function beeTurn(state: TileState, dict: Dictionary): TileState {
  if (state.over || state.turn !== 'BEE') return state
  const { move, seed } = chooseBeeMove(state, dict)
  if (!move) return swapTiles({ ...state, seed }, 'BEE')
  return playMove({ ...state, seed }, 'BEE', move.placements, dict)
}

/** A move to point her towards when she is stuck: a short, ordinary word. */
export function hintMove(state: TileState, dict: Dictionary): Move | null {
  const moves = findMoves(state.board, state.racks.YOU, dict)
  if (moves.length === 0) return null
  // Prefer a word that needs at least two of her letters, so the hint leaves her something to work out.
  const two = moves.filter((m) => m.placements.length >= 2)
  return (two.length ? two : moves).sort((a, b) => Math.abs(a.word.length - 4) - Math.abs(b.word.length - 4) || b.score - a.score || a.word.localeCompare(b.word))[0]
}
