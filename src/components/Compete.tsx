import { useState } from 'react'
import type { JudgeState } from '../engine/judgeStateMachine.ts'
import { seededShuffle, unlockedWords } from '../lib/unlocks.ts'
import type { BeeWord } from '../types/game.ts'
import { JudgeRound } from './BeeStage.tsx'

export const ROUND_SIZE = 8

interface Result {
  word: BeeWord
  correct: boolean
  attempt: string
  coaching: string | null
  memoryTrick: string | null
}

/**
 * The competition module: a Scripps-style round. No givens, no hints, no word length.
 * She may ask the Judge anything, then spells once. Coach's Corner comes after the round.
 */
/**
 * Eight words near her level that she has not been asked on the stage before.
 * When the unasked words run out, the list starts over.
 */
export function pickRound(
  solved: Record<string, unknown>,
  unlockAll: boolean,
  seen: readonly string[],
  seed: number,
): { words: BeeWord[]; startedOver: boolean } {
  // The stage reaches a little past what she has solved so far.
  const level = 2.4 + Object.keys(solved).length * 0.02
  const pool = unlockedWords(solved, unlockAll).sort((a, b) => a.difficulty - b.difficulty)
  const near = pool.filter((w, i) => w.difficulty <= level || i < ROUND_SIZE * 6)
  const fresh = near.filter((w) => !seen.includes(w.id))
  const startedOver = fresh.length < ROUND_SIZE
  return { words: seededShuffle(startedOver ? near : fresh, seed).slice(0, ROUND_SIZE), startedOver }
}

export function Compete({
  solved,
  unlockAll,
  seen,
  onAsked,
}: {
  solved: Record<string, unknown>
  unlockAll: boolean
  /** Words already asked on the stage in earlier rounds. */
  seen: readonly string[]
  onAsked: (wordIds: string[], startedOver: boolean) => void
}) {
  const [round, setRound] = useState(0)
  const [words, setWords] = useState<BeeWord[] | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [answered, setAnswered] = useState(false)

  const start = () => {
    const picked = pickRound(solved, unlockAll, seen, Math.floor(Math.random() * 1e9))
    setWords(picked.words)
    onAsked(picked.words.map((w) => w.id), picked.startedOver)
    setRound((r) => r + 1)
    setIndex(0)
    setResults([])
    setAnswered(false)
  }

  if (!words) {
    return (
      <div className="flex flex-col items-center gap-8 pt-16">
        <div className="text-7xl">🎤</div>
        <p className="max-w-xs text-center text-xl text-slate-700">
          {ROUND_SIZE} words. One try each, just like the real bee.
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-amber-400 px-12 py-5 text-3xl font-bold shadow-lg active:scale-95"
        >
          Start
        </button>
      </div>
    )
  }

  if (index >= words.length) {
    const right = results.filter((r) => r.correct).length
    const missed = results.filter((r) => !r.correct)
    return (
      <div data-testid="round-results" className="flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold">
          You spelled {right} of {results.length} words!
        </h2>
        <div className="text-3xl">{results.map((r) => (r.correct ? '🌸' : '🌱')).join(' ')}</div>
        <ul className="flex flex-wrap gap-2">
          {results.map((r) => (
            <li
              key={r.word.id}
              className={`rounded-full px-3 py-1 font-semibold ${
                r.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {r.correct ? '✓' : '✗'} {r.word.word}
            </li>
          ))}
        </ul>
        {missed.length > 0 && (
          <section className="rounded-3xl border-2 border-violet-200 bg-violet-50 p-5">
            <h3 className="mb-3 text-lg font-bold text-violet-800">🧢 Coach&rsquo;s Corner</h3>
            <ul className="flex flex-col gap-4">
              {missed.map((r) => (
                <li key={r.word.id}>
                  <p className="font-semibold">
                    {r.word.word.toUpperCase().split('').join('-')}{' '}
                    <span className="font-normal text-slate-500">(you spelled {r.attempt.toUpperCase()})</span>
                  </p>
                  {r.coaching && <p className="text-slate-700">{r.coaching}</p>}
                  {r.memoryTrick && <p className="text-violet-800">💡 {r.memoryTrick}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-amber-500 px-6 py-3 text-lg font-bold text-white hover:bg-amber-600"
          >
            Play another round
          </button>
          <button type="button" onClick={() => setWords(null)} className="underline">
            Done
          </button>
        </div>
      </div>
    )
  }

  const word = words[index]
  const onResolved = (state: JudgeState) => {
    setResults((r) => [
      ...r,
      {
        word,
        correct: state.outcome === 'CORRECT',
        attempt: state.lastDiagnosis?.attempt ?? '',
        coaching: state.coachNote?.coaching ?? null,
        memoryTrick: state.coachNote?.memoryTrick ?? null,
      },
    ])
    setAnswered(true)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div data-testid="round-progress" aria-label={`Word ${index + 1} of ${words.length}`} className="flex gap-2 text-xl">
        {words.map((w, i) => (
          <span key={w.id}>{i < results.length ? (results[i].correct ? '🌸' : '🌱') : i === index ? '🟡' : '⚪'}</span>
        ))}
      </div>
      <JudgeRound key={`${round}-${word.id}`} word={word} mode="CONTEST" onResolved={onResolved} />
      {answered && (
        <button
          type="button"
          onClick={() => {
            setIndex((i) => i + 1)
            setAnswered(false)
          }}
          className="rounded-full bg-emerald-500 px-10 py-4 text-2xl font-bold text-white shadow-lg"
        >
          Next ▶
        </button>
      )}
    </div>
  )
}
