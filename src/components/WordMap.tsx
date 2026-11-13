import { useState } from 'react'
import { PATTERNS, getCard, getWord } from '../data/index.ts'
import { LEVEL_FLOOR, type Progress } from '../lib/unlocks.ts'
import type { BeeWord } from '../types/game.ts'
import { WordCardFace } from './WordCards.tsx'

/**
 * Her garden: every word she has solved, as a flower. It is a collection to look
 * back on, not a menu to work through; the Play button decides what comes next.
 */
export function WordMap({ progress, onPlay }: { progress: Progress; onPlay: (words: BeeWord[]) => void }) {
  const [open, setOpen] = useState<BeeWord | null>(null)
  // One field of flowers, no group headings.
  const flowers = PATTERNS.flatMap((p) => [...p.anchorWordIds, ...p.guidedWordIds, ...p.transferProbeIds])
    .filter((id) => progress.solved[id])
    .map((id) => getWord(id)!)
    // Words below her level are no longer part of the app, so they do not show here either.
    .filter((w) => w && w.difficulty >= LEVEL_FLOOR)

  if (open) {
    const card = getCard(open.id)
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <button type="button" onClick={() => setOpen(null)} className="self-start font-semibold text-sky-700">
          ◀ My garden
        </button>
        {card && <WordCardFace word={open} card={card} />}
        <button
          type="button"
          onClick={() => onPlay([open])}
          className="rounded-full bg-amber-400 px-10 py-4 text-2xl font-bold shadow-lg active:scale-95"
        >
          ▶ Play it again
        </button>
      </div>
    )
  }

  if (flowers.length === 0) {
    return (
      <div data-testid="garden-empty" className="flex flex-col items-center gap-6 pt-16 text-center">
        <div className="text-7xl">🌱</div>
        <p className="max-w-xs text-2xl font-semibold text-slate-700">Your garden is waiting. Play to grow your first flower!</p>
      </div>
    )
  }

  return (
    <div data-testid="garden" className="flex w-full flex-wrap justify-center gap-5">
      {flowers.map((w) => (
        <button key={w.id} type="button" onClick={() => setOpen(w)} className="flex w-20 flex-col items-center gap-1">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow active:scale-95">
            {progress.solved[w.id] === 'CLEAN' ? '🌸' : '🌱'}
          </span>
          <span className="text-sm font-semibold text-slate-600">{w.word}</span>
        </button>
      ))}
    </div>
  )
}
