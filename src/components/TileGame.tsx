import { useEffect, useMemo, useState } from 'react'
import { getWord } from '../data/index.ts'
import {
  analyse,
  beeTurn,
  CENTER,
  hintMove,
  newGame,
  playMove,
  SIZE,
  swapTiles,
  type Move,
  type TileState,
} from '../engine/tileGame.ts'
import { clipKeys } from '../lib/clips.ts'
import { chime } from '../lib/sfx.ts'
import { speak } from '../lib/speak.ts'
import { TILE_DICTIONARY } from '../lib/tileWords.ts'
import { IconButton } from './IconButton.tsx'

const SAVE_KEY = 'spelling-bee-tiles'
type Dir = 'ACROSS' | 'DOWN'
/** A letter she has put on the board but not played yet; `i` is its place in her rack. */
interface Pending {
  r: number
  c: number
  l: string
  i: number
}

function loadGame(): TileState {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as TileState | null
    if (saved && Array.isArray(saved.board) && saved.board.length === SIZE && !saved.over) return saved
  } catch {
    // start a new game
  }
  return newGame(Math.floor(Math.random() * 1e9))
}

const sayWord = (word: string) => {
  const w = word.toLowerCase()
  speak(w, false, getWord(`word_${w}`) ? clipKeys.word(w) : undefined)
}

/**
 * Bee tiles: she and the bee take turns making words on a small board.
 * Her letters are checked as she puts them down, so she knows before she plays
 * whether she has a word, the start of one, or letters that cannot make one.
 */
export function TileGame({ onWord, onHome }: { onWord: () => void; onHome: () => void }) {
  const [game, setGame] = useState<TileState>(loadGame)
  const [pending, setPending] = useState<Pending[]>([])
  const [cursor, setCursor] = useState<{ r: number; c: number; dir: Dir } | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [hint, setHint] = useState<{ move: Move; shown: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game))
    } catch {
      // the game still works without saving
    }
  }, [game])

  // The bee takes its turn after a short pause, so she sees it happen.
  useEffect(() => {
    if (game.over || game.turn !== 'BEE') return
    const timer = window.setTimeout(() => setGame((g) => beeTurn(g, TILE_DICTIONARY)), 1100)
    return () => window.clearTimeout(timer)
  }, [game.turn, game.over])

  useEffect(() => {
    if (game.over) chime(game.scores.YOU >= game.scores.BEE ? 'BLOOM' : 'GROW')
  }, [game.over]) // eslint-disable-line

  const check = useMemo(() => analyse(game.board, pending, TILE_DICTIONARY), [game.board, pending])
  const myTurn = game.turn === 'YOU' && !game.over
  const used = new Set(pending.map((p) => p.i))
  const pendingAt = (r: number, c: number) => pending.find((p) => p.r === r && p.c === c)
  const free = (r: number, c: number, list = pending) =>
    r >= 0 && c >= 0 && r < SIZE && c < SIZE && !game.board[r][c] && !list.some((p) => p.r === r && p.c === c)

  /** The next empty square along a line, skipping letters already there. */
  const nextFree = (r: number, c: number, dir: Dir, list: Pending[]) => {
    const [dr, dc] = dir === 'ACROSS' ? [0, 1] : [1, 0]
    let rr = r + dr
    let cc = c + dc
    while (rr < SIZE && cc < SIZE && !free(rr, cc, list)) {
      rr += dr
      cc += dc
    }
    return rr < SIZE && cc < SIZE ? { r: rr, c: cc, dir } : null
  }

  const place = (i: number, r: number, c: number, dir: Dir) => {
    const list = [...pending, { r, c, l: game.racks.YOU[i], i }]
    // Two letters in one column mean she is writing downwards.
    const going: Dir = list.length >= 2 ? (list.every((p) => p.c === list[0].c) ? 'DOWN' : 'ACROSS') : dir
    setPending(list)
    setCursor(nextFree(r, c, going, list))
    setPicked(null)
    setHint(null)
    setNote(null)
  }

  const tapRack = (i: number) => {
    if (!myTurn || used.has(i)) return
    if (cursor && free(cursor.r, cursor.c)) place(i, cursor.r, cursor.c, cursor.dir)
    else setPicked(picked === i ? null : i)
  }

  const tapSquare = (r: number, c: number) => {
    if (!myTurn) return
    const mine = pendingAt(r, c)
    if (mine) {
      // Tapping one of her loose letters takes it back.
      setPending(pending.filter((p) => p !== mine))
      setCursor({ r, c, dir: cursor?.dir ?? 'ACROSS' })
      return
    }
    if (game.board[r][c]) return
    if (picked !== null) return place(picked, r, c, cursor?.dir ?? 'ACROSS')
    setCursor(cursor && cursor.r === r && cursor.c === c ? { r, c, dir: cursor.dir === 'ACROSS' ? 'DOWN' : 'ACROSS' } : { r, c, dir: cursor?.dir ?? 'ACROSS' })
  }

  const clear = () => {
    setPending([])
    setCursor(null)
    setPicked(null)
    setHint(null)
  }

  const play = () => {
    if (check.state !== 'VALID') return
    setGame((g) => playMove(g, 'YOU', pending, TILE_DICTIONARY))
    chime('GROW')
    onWord()
    clear()
    setNote(null)
  }

  const swap = () => {
    clear()
    setNote(null)
    setGame((g) => swapTiles(g, 'YOU'))
  }

  /** Stuck? First show where a word could go, then put its first letter down. */
  const stuck = () => {
    const move = hint?.move ?? hintMove(game, TILE_DICTIONARY)
    if (!move) {
      setNote('I cannot see a word with these letters. Try new letters.')
      return
    }
    if (!hint) {
      setPending([])
      setPicked(null)
      setCursor(null)
      setHint({ move, shown: 0 })
      setNote(`A ${move.word.length}-letter word fits in the blue squares.`)
      return
    }
    const first = move.placements[0]
    const i = game.racks.YOU.findIndex((l, n) => l === first.l && !used.has(n))
    if (hint.shown > 0 || i < 0) return
    const list = [{ ...first, i }]
    setPending(list)
    const dir: Dir = move.placements.length > 1 && move.placements[1].c === first.c ? 'DOWN' : 'ACROSS'
    setCursor(nextFree(first.r, first.c, dir, list))
    setHint({ move, shown: 1 })
    setNote(move.placements.length > 1 ? 'There is one letter of it. What could the word be?' : null)
  }

  const hinted = (r: number, c: number) => !!hint && hint.move.placements.some((p) => p.r === r && p.c === c)
  const lastCell = (r: number, c: number) => !!game.last && game.last.cells.some(([rr, cc]) => rr === r && cc === c)
  const tone =
    check.state === 'VALID'
      ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
      : check.state === 'PARTIAL'
        ? 'border-amber-400 bg-amber-100 text-amber-900'
        : 'border-rose-400 bg-rose-100 text-rose-900'
  const status = note ?? (pending.length > 0 ? check.message : null)
  const statusTone =
    note || pending.length === 0 ? 'text-slate-600' : check.state === 'VALID' ? 'text-emerald-700' : check.state === 'PARTIAL' ? 'text-amber-700' : 'text-rose-700'

  if (game.over) {
    const { YOU, BEE } = game.scores
    return (
      <section data-testid="tiles-over" className="flex flex-1 flex-col items-center justify-center gap-5 pb-10 text-center">
        <div className="text-7xl">{YOU >= BEE ? '🌻' : '🐝'}</div>
        <h2 className="text-3xl font-bold">{YOU > BEE ? 'You made more this time!' : YOU === BEE ? 'A tie with the bee!' : 'The bee made a few more this time.'}</h2>
        <p className="text-xl text-slate-600">
          You {YOU} · Bee {BEE}
        </p>
        <p className="text-lg text-slate-600">Good game. Every word on that board is real.</p>
        <div className="flex gap-8">
          <IconButton
            icon="🔁"
            label="Play again"
            size="lg"
            onClick={() => {
              clear()
              setNote(null)
              setGame(newGame(Math.floor(Math.random() * 1e9)))
            }}
          />
          <IconButton icon="🏠" label="Home" size="lg" onClick={onHome} />
        </div>
      </section>
    )
  }

  return (
    <section data-testid="tiles" className="flex w-full max-w-md flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between text-lg font-bold text-slate-700">
        <span data-testid="tiles-you" className={`rounded-full px-3 py-1 ${myTurn ? 'bg-amber-300' : 'bg-white'}`}>
          You {game.scores.YOU}
        </span>
        <span className="text-sm font-semibold text-slate-500">{game.bag.length} letters left</span>
        <span data-testid="tiles-bee" className={`rounded-full px-3 py-1 ${!myTurn ? 'bg-amber-300' : 'bg-white'}`}>
          🐝 {game.scores.BEE}
        </span>
      </div>

      <div data-testid="tiles-board" className="grid w-full max-w-[min(23rem,calc(100dvh-23.5rem))] grid-cols-7 gap-1 rounded-2xl bg-emerald-200 p-1.5">
        {game.board.map((row, r) =>
          row.map((cell, c) => {
            const mine = pendingAt(r, c)
            const here = cursor && cursor.r === r && cursor.c === c && !mine && !cell
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={cell ?? mine?.l ?? `Row ${r + 1}, square ${c + 1}`}
                onClick={() => tapSquare(r, c)}
                className={`flex aspect-square items-center justify-center rounded-lg border-2 text-xl font-bold sm:text-2xl ${
                  cell
                    ? `border-amber-300 bg-amber-50 text-slate-800 ${lastCell(r, c) ? 'ring-2 ring-amber-500' : ''}`
                    : mine
                      ? tone
                      : here
                        ? 'border-dashed border-sky-500 bg-sky-50 text-sky-500'
                        : hinted(r, c)
                          ? 'animate-pulse border-sky-300 bg-sky-200'
                          : 'border-transparent bg-emerald-50 text-amber-400'
                }`}
              >
                {cell ?? mine?.l ?? (here ? (cursor.dir === 'ACROSS' ? '→' : '↓') : r === CENTER && c === CENTER ? '⭐' : '')}
              </button>
            )
          }),
        )}
      </div>

      <p data-testid="tiles-status" aria-live="polite" className={`min-h-12 text-center text-base font-semibold leading-snug ${statusTone}`}>
        {status ??
          (!myTurn
            ? 'The bee is thinking…'
            : game.last?.by === 'BEE'
              ? game.last.kind === 'PLAY'
                ? ''
                : 'The bee had no word and took new letters. Your turn!'
              : 'Tap a square, then tap your letters.')}
        {!status && myTurn && game.last?.by === 'BEE' && game.last.kind === 'PLAY' && (
          <button type="button" onClick={() => sayWord(game.last!.words[0])} className="rounded-full bg-white px-3 py-1 shadow-sm">
            🐝 made {game.last.words.join(' and ')} (+{game.last.score}) 🔊
          </button>
        )}
      </p>

      <div data-testid="tiles-rack" className="flex gap-1.5">
        {game.racks.YOU.map((l, i) => (
          <button
            key={i}
            type="button"
            disabled={!myTurn || used.has(i)}
            onClick={() => tapRack(i)}
            className={`flex h-12 w-11 items-center justify-center rounded-lg border-2 text-2xl font-bold shadow active:scale-95 ${
              used.has(i) ? 'border-stone-200 bg-stone-100 text-transparent shadow-none' : picked === i ? 'border-sky-500 bg-sky-100' : 'border-amber-300 bg-amber-50'
            } disabled:opacity-60`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex items-start justify-center gap-3">
        <button
          type="button"
          data-testid="tiles-play"
          onClick={play}
          disabled={!myTurn || check.state !== 'VALID'}
          className="rounded-full bg-emerald-500 px-6 py-3 text-xl font-bold text-white shadow-lg disabled:opacity-30"
        >
          Play ✓
        </button>
        <IconButton icon="↩️" label="Take back" onClick={clear} disabled={!myTurn || pending.length === 0} />
        <IconButton icon="💡" label="Stuck?" onClick={stuck} disabled={!myTurn} />
        <IconButton icon="🔄" label={game.bag.length >= game.racks.YOU.length ? 'New letters' : 'Skip'} onClick={swap} disabled={!myTurn} />
      </div>
    </section>
  )
}
