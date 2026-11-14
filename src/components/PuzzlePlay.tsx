import { useEffect, useReducer, useState } from 'react'
import { createJudge, judgeReducer } from '../engine/judgeStateMachine.ts'
import { MAX_STRIKES, createPuzzle, isCleanSolve, puzzleReducer } from '../engine/puzzleEngine.ts'
import { StylusTileCanvas } from '../input/StylusTileCanvas.tsx'
import { recognitionCheckFor } from '../lib/recognition.ts'
import { puzzleAttempt, type NewAttempt } from '../lib/attempts.ts'
import { clipKeys } from '../lib/clips.ts'
import { speak } from '../lib/speak.ts'
import type { BeeWord } from '../types/game.ts'
import { AskJudge } from './AskJudge.tsx'
import { IconButton } from './IconButton.tsx'

/** Tile indices that start a new syllable. */
function syllableStarts(word: BeeWord): Set<number> {
  const starts = new Set<number>()
  let at = 0
  for (const s of word.syllables.slice(0, -1)) starts.add((at += s.length))
  return starts
}

const NEXT = 'rounded-full bg-emerald-500 px-10 py-4 text-2xl font-bold text-white shadow-lg active:scale-95'

export function DetectiveCheck({ word, onDone }: { word: BeeWord; onDone: () => void }) {
  const check = recognitionCheckFor(word)
  const [picked, setPicked] = useState<string | null>(null)
  const right = picked === check.correctAnswer

  // She arrives here by tapping Next, so the question may be read aloud.
  useEffect(() => {
    speak(check.question, false, clipKeys.secret(word.word))
  }, [check.question])

  return (
    <section data-testid="detective" className="flex w-full max-w-md flex-col gap-4">
      <p className="text-center text-2xl font-semibold leading-snug">🔍 {check.question}</p>
      {check.options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={right}
          onClick={() => {
            setPicked(o)
            o === check.correctAnswer
              ? speak('Great detective work!', false, clipKeys.greatDetective)
              : speak('Not quite. Try another one.', false, clipKeys.notQuite)
          }}
          className={`rounded-2xl px-5 py-4 text-left text-lg shadow ${
            picked === o ? (o === check.correctAnswer ? 'bg-emerald-200' : 'bg-rose-100') : 'bg-white'
          }`}
        >
          {o}
        </button>
      ))}
      {right && (
        <button type="button" onClick={onDone} className={`self-center ${NEXT}`}>
          Next ▶
        </button>
      )}
    </section>
  )
}

/** One deduction puzzle: hear the word, fill the gaps. Three flowers, no clock. */
export function PuzzlePlay({
  word,
  onDone,
}: {
  word: BeeWord
  onDone: (clean: boolean, attempt: NewAttempt) => void
}) {
  const [state, dispatch] = useReducer(puzzleReducer, undefined, () => createPuzzle(word))
  const [judge, ask] = useReducer(judgeReducer, undefined, () => createJudge(word, 'ADVENTURE'))
  const [selected, setSelected] = useState<number | null>(null)
  const [tool, setTool] = useState<'TAP' | 'PENCIL' | 'WRITE'>('TAP')

  // Nothing is spoken on arrival; she taps the speaker when she is ready.
  useEffect(() => {
    if (judge.line.kind !== 'PROMPT') speak(judge.line.spoken, judge.line.slow, judge.line.clips)
  }, [judge.line])

  const over = state.status !== 'PLAYING'
  const starts = syllableStarts(word)
  const active =
    state.gaps.find((g) => g.index === selected && g.value === null) ?? state.gaps.find((g) => g.value === null)
  const toggle = (t: 'PENCIL' | 'WRITE') => setTool((cur) => (cur === t ? 'TAP' : t))

  return (
    <div className="flex w-full flex-col items-center gap-7">
      <div data-testid="strikes" aria-label={`${MAX_STRIKES - state.strikes} tries left`} className="text-2xl">
        {Array.from({ length: MAX_STRIKES }, (_, i) => (i < MAX_STRIKES - state.strikes ? '🌼' : '🥀')).join(' ')}
      </div>

      <AskJudge line={judge.line} onAsk={(intent) => ask({ type: 'INTENT', intent })} />

      <div data-testid="puzzle-tiles" className="flex flex-wrap items-center justify-center gap-y-2">
        {[...word.word].map((ch, i) => {
          const gap = state.gaps.find((g) => g.index === i)
          const open = gap && gap.value === null
          const lit = open && (active?.index === i || state.coachGap === i)
          return (
            <div key={i} className={`flex items-center ${starts.has(i) ? 'ml-2' : ''}`}>
              <button
                type="button"
                disabled={!open}
                onClick={() => setSelected(i)}
                aria-label={open ? `Box ${i + 1}, empty` : `Box ${i + 1}, ${gap?.value ?? ch.toUpperCase()}`}
                className={`mx-0.5 flex h-16 w-12 items-center justify-center rounded-xl text-3xl font-bold sm:w-14 ${
                  !gap
                    ? 'bg-white text-slate-700 shadow-sm'
                    : open
                      ? lit
                        ? 'bg-amber-100 ring-4 ring-amber-400'
                        : 'bg-white ring-2 ring-sky-300'
                      : gap.filledByCoach
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {open ? (
                  <span className="flex gap-1 text-sm font-semibold text-slate-400">
                    {gap.candidates.map((c) => (
                      <span key={c} className={gap.eliminated.includes(c) ? 'line-through opacity-40' : ''}>
                        {c.toLowerCase()}
                      </span>
                    ))}
                  </span>
                ) : (
                  (gap?.value ?? ch.toUpperCase())
                )}
              </button>
            </div>
          )
        })}
      </div>

      {!over && active && tool !== 'WRITE' && (
        <div className="flex flex-col items-center gap-2">
          {tool === 'PENCIL' && <p className="font-semibold text-slate-600">Tap a letter to cross it out</p>}
          <div className="flex items-center gap-4">
            {active.candidates.map((c) => {
              const out = active.eliminated.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Letter ${c}`}
                  onClick={() =>
                    dispatch({ type: tool === 'PENCIL' ? 'TOGGLE_NOTE' : 'PLACE', index: active.index, letter: c })
                  }
                  className={`h-20 w-20 rounded-full text-4xl font-bold shadow-lg active:scale-95 ${
                    out ? 'bg-slate-100 text-slate-300 line-through' : 'bg-white text-slate-800'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!over && active && tool === 'WRITE' && (
        <StylusTileCanvas
          allowed={active.candidates.filter((c) => !active.eliminated.includes(c))}
          onLetter={(letter) => dispatch({ type: 'PLACE', index: active.index, letter })}
        />
      )}

      {state.feedback && (
        <p data-testid="feedback" className="max-w-md text-center text-lg text-slate-700">
          {state.feedback}
        </p>
      )}

      {!over && (
        <div className="flex gap-6">
          <IconButton icon="✏️" label="Pencil" active={tool === 'PENCIL'} onClick={() => toggle('PENCIL')} />
          <IconButton icon="✍️" label="Write" active={tool === 'WRITE'} onClick={() => toggle('WRITE')} />
          <IconButton icon="💡" label="Help" onClick={() => dispatch({ type: 'COACH' })} />
        </div>
      )}

      {over && (
        <button
          type="button"
          onClick={() =>
            onDone(isCleanSolve(state), puzzleAttempt(word.id, state.status === 'SOLVED', isCleanSolve(state), judge.intentCounts))
          }
          className={NEXT}
        >
          {isCleanSolve(state) ? '🌸 ' : ''}Next ▶
        </button>
      )}
    </div>
  )
}
