import { useState } from 'react'
import type { JudgeState } from '../engine/judgeStateMachine.ts'
import { attemptFromJudge, type NewAttempt } from '../lib/attempts.ts'
import { BEE_LEVELS, RIBBONS, WIN_AT, badgesEarned, levelUpLine, type RibbonKey } from '../lib/awards.ts'
import { clipKeys } from '../lib/clips.ts'
import { familyEmoji } from '../lib/recognition.ts'
import { chime } from '../lib/sfx.ts'
import { speak } from '../lib/speak.ts'
import { seededShuffle, unlockedWords, type Progress } from '../lib/unlocks.ts'
import type { BeeWord } from '../types/game.ts'
import { getCard } from '../data/index.ts'
import { JudgeRound } from './BeeStage.tsx'
import { Celebration } from './Celebration.tsx'
import { WordCardFace } from './WordCards.tsx'

export const ROUND_SIZE = 8

interface Result {
  word: BeeWord
  correct: boolean
  attempt: string
  coaching: string | null
  memoryTrick: string | null
  close: boolean
}

/**
 * The competition module: a Scripps-style round. No givens, no hints, no word length.
 * She may ask the Judge anything, then spells once. Coach's Corner comes after the round.
 */
/**
 * Eight words around `center` (her level plus the bee's boost) that she has not
 * been asked on the stage before. When the unasked words run out, the list starts over.
 */
export function pickRound(
  solved: Record<string, unknown>,
  unlockAll: boolean,
  seen: readonly string[],
  seed: number,
  center = 2.4,
): { words: BeeWord[]; startedOver: boolean } {
  const pool = unlockedWords(solved, unlockAll)
  const reach = (w: BeeWord) => Math.max(0, center - 0.5 - w.difficulty, w.difficulty - (center + 0.3))
  const byReach = [...pool].sort((a, b) => reach(a) - reach(b) || a.difficulty - b.difficulty)
  // Everything inside the band, topped up with the nearest words so a round is never short.
  const near = byReach.filter((w, i) => reach(w) === 0 || i < ROUND_SIZE * 5)
  const fresh = near.filter((w) => !seen.includes(w.id))
  const startedOver = fresh.length < ROUND_SIZE
  return { words: seededShuffle(startedOver ? near : fresh, seed).slice(0, ROUND_SIZE), startedOver }
}

function Showcase({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const won = progress.beesWon ?? 0
  const badges = badgesEarned(progress.solved)
  const flowers = Object.values(progress.solved).filter((r) => r === 'CLEAN').length
  return (
    <div data-testid="showcase" className="flex w-full flex-col items-center gap-7">
      <button type="button" onClick={onBack} className="self-start font-semibold text-sky-700">
        ◀ Bee stage
      </button>
      <h2 className="text-2xl font-bold">My trophies</h2>

      <section className="flex w-full flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-700">Bees I have won</h3>
        <div className="grid grid-cols-3 gap-3">
          {BEE_LEVELS.map((b, i) => (
            <div key={b.name} className={`flex flex-col items-center gap-1 rounded-2xl bg-white p-3 text-center shadow-sm ${i < won ? '' : 'opacity-40'}`}>
              <span className="text-4xl">{i < won ? '🏆' : b.emoji}</span>
              <span className="text-sm font-semibold leading-tight">{b.name}</span>
              <span className="text-xs text-slate-500">{i < won ? 'Won!' : i === won ? 'Playing now' : 'Still to come'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex w-full flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-700">Ribbons</h3>
        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(RIBBONS) as RibbonKey[]).map((k) => (
            <div key={k} className={`flex flex-col items-center rounded-2xl bg-white p-3 text-center shadow-sm ${progress.ribbons?.[k] ? '' : 'opacity-40'}`}>
              <span className="text-4xl">{RIBBONS[k].emoji}</span>
              <span className="text-xl font-bold tabular-nums">{progress.ribbons?.[k] ?? 0}</span>
              <span className="text-xs text-slate-500">{RIBBONS[k].name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex w-full flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-700">Word family badges</h3>
        {badges.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map((p) => (
              <div key={p.patternId} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-3 text-center shadow-sm">
                <span className="text-4xl">{familyEmoji(p.badgeName)}</span>
                <span className="text-sm font-semibold leading-tight">{p.badgeName.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').trim()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-600">Solve two mystery words from one family, first time, to earn its badge.</p>
        )}
      </section>

      <p className="text-lg font-semibold text-slate-600">🌸 {flowers} flowers in my garden</p>
    </div>
  )
}

export function Compete({
  progress,
  unlockAll,
  target,
  onAsked,
  onAttempt,
  onRoundEnd,
}: {
  progress: Progress
  unlockAll: boolean
  /** Her everyday word level, from the difficulty calibrator. */
  target: number
  onAsked: (wordIds: string[], startedOver: boolean) => void
  onAttempt: (attempt: NewAttempt) => void
  /** Called once when a round ends; returns the ribbon and any bee she just won. */
  onRoundEnd: (right: number, total: number) => { ribbon: RibbonKey; wonLevel: number | null }
}) {
  const { solved } = progress
  const seen = progress.stageSeen ?? []
  const level = Math.min(progress.stageLevel ?? 0, BEE_LEVELS.length - 1)
  const bee = BEE_LEVELS[level]
  const [round, setRound] = useState(0)
  const [words, setWords] = useState<BeeWord[] | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [answered, setAnswered] = useState(false)
  const [showcase, setShowcase] = useState(false)
  const [award, setAward] = useState<{ ribbon: RibbonKey; wonLevel: number | null; bee: string } | null>(null)

  const start = () => {
    const picked = pickRound(solved, unlockAll, seen, Math.floor(Math.random() * 1e9), target + bee.boost)
    setWords(picked.words)
    onAsked(picked.words.map((w) => w.id), picked.startedOver)
    setRound((r) => r + 1)
    setIndex(0)
    setResults([])
    setAnswered(false)
    setAward(null)
  }

  if (showcase) return <Showcase progress={progress} onBack={() => setShowcase(false)} />

  if (!words) {
    return (
      <div className="flex flex-col items-center gap-7 pt-10">
        <div className="text-7xl">{bee.emoji}</div>
        <h2 data-testid="bee-level" className="text-3xl font-bold">
          {bee.name}
        </h2>
        <p className="max-w-xs text-center text-xl text-slate-700">
          {ROUND_SIZE} words, one try each. Spell {WIN_AT} to win
          {level + 1 < BEE_LEVELS.length && (progress.beesWon ?? 0) <= level ? ` and move up to the ${BEE_LEVELS[level + 1].name}` : ''}.
        </p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-amber-400 px-12 py-5 text-3xl font-bold shadow-lg active:scale-95"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => setShowcase(true)}
          className="rounded-full bg-white px-6 py-3 text-lg font-semibold text-slate-700 shadow"
        >
          🏆 My trophies
        </button>
      </div>
    )
  }

  if (index >= words.length) {
    const right = results.filter((r) => r.correct).length
    const missed = results.filter((r) => !r.correct)
    const ribbon = award ? RIBBONS[award.ribbon] : null
    return (
      <div data-testid="round-results" className="flex flex-col items-center gap-6">
        {ribbon && award && (
          <div data-testid="award" className="flex flex-col items-center gap-2">
            <span className="bee-bloom text-8xl" aria-hidden>
              {award.wonLevel !== null ? '🏆' : ribbon.emoji}
            </span>
            <p className="bee-rise max-w-sm text-center text-2xl font-bold">
              {award.wonLevel !== null ? levelUpLine(award.wonLevel) : ribbon.line}
            </p>
            {award.wonLevel !== null && (
              <p className="bee-rise text-lg text-slate-600">
                {ribbon.emoji} {ribbon.name}
              </p>
            )}
          </div>
        )}
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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={start}
            className="rounded-full bg-amber-400 px-8 py-3 text-xl font-bold shadow-lg"
          >
            Play another round
          </button>
          <button type="button" onClick={() => setShowcase(true)} className="rounded-full bg-white px-5 py-3 font-semibold shadow">
            🏆 My trophies
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
    onAttempt(attemptFromJudge(state, 'STAGE'))
    setResults((r) => [
      ...r,
      {
        word,
        correct: state.outcome === 'CORRECT',
        attempt: state.lastDiagnosis?.attempt ?? '',
        coaching: state.coachNote?.coaching ?? null,
        memoryTrick: state.coachNote?.memoryTrick ?? null,
        close: (state.lastDiagnosis?.errorTileIndex ?? 0) >= word.word.length / 2,
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
        <Celebration
          key={`moment-${word.id}`}
          speech="AFTER"
          moment={{
            r: results[results.length - 1]?.correct ? 'CLEAN' : 'MISSED',
            mystery: word.role === 'TRANSFER_PROBE',
            close: results[results.length - 1]?.close,
            seed: index + word.word.length,
          }}
        />
      )}
      {answered && getCard(word.id) && <WordCardFace key={word.id} word={word} card={getCard(word.id)!} />}
      {answered && (
        <button
          type="button"
          onClick={() => {
            if (index + 1 >= words.length) {
              // The round is over: award the ribbon (and the bee, if she won it) exactly once.
              const right = results.filter((r) => r.correct).length
              const won = onRoundEnd(right, results.length)
              setAward({ ...won, bee: bee.name })
              const line = won.wonLevel !== null ? levelUpLine(won.wonLevel) : RIBBONS[won.ribbon].line
              chime(right >= WIN_AT ? 'BLOOM' : 'GROW')
              speak(line, false, clipKeys.text(line))
            }
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
