import { useEffect, useReducer, useState } from 'react'
import { WORDS } from '../data/index.ts'
import { createJudge, judgeReducer, type JudgeState } from '../engine/judgeStateMachine.ts'
import { SpellEntry } from '../input/SpellEntry.tsx'
import { speak } from '../lib/speak.ts'
import type { BeeWord, GameMode } from '../types/game.ts'
import { AskJudge } from './AskJudge.tsx'

/** One word with the Judge: hear it, ask, spell by tapping, writing or speaking. */
export function JudgeRound({
  word,
  mode,
  debug,
  hideLength,
  onResolved,
}: {
  word: BeeWord
  mode: GameMode
  debug?: boolean
  /** Do not show how many letters the word has (needed when the length is the lesson, e.g. doubling). */
  hideLength?: boolean
  onResolved?: (state: JudgeState) => void
}) {
  const [state, dispatch] = useReducer(judgeReducer, undefined, () => createJudge(word, mode))
  const [attempt, setAttempt] = useState('')

  // The Judge never talks on arrival: she taps the speaker when she is ready.
  useEffect(() => {
    if (state.line.kind !== 'PROMPT') speak(state.line.spoken, state.line.slow, state.line.clip)
  }, [state.line])

  const resolved = state.phase === 'RESOLVED'
  useEffect(() => {
    if (resolved) onResolved?.(state)
    // Fire once, when the word resolves.
  }, [resolved]) // eslint-disable-line

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <AskJudge line={state.line} onAsk={(intent) => dispatch({ type: 'INTENT', intent })} />

      {state.candidatePair && state.highlightTileIndex !== null && !resolved && (
        <div className="flex items-center gap-3">
          {state.candidatePair.map((letter) => (
            <button
              key={letter}
              type="button"
              aria-label={`Twin choice ${letter}`}
              onClick={() => {
                const i = state.highlightTileIndex!
                setAttempt(attempt.slice(0, i) + letter + attempt.slice(i + 1))
              }}
              className="h-14 w-14 rounded-full bg-white text-2xl font-bold shadow ring-2 ring-cyan-400"
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      <SpellEntry
        word={word}
        letters={attempt}
        onChange={setAttempt}
        onSubmit={() => dispatch({ type: 'SUBMIT', attempt })}
        disabled={resolved}
        fixedSlots={mode === 'ADVENTURE' && !hideLength ? word.word.length : undefined}
        highlight={state.highlightTileIndex}
      />

      {debug && (
        <pre data-testid="debug" className="w-full overflow-x-auto rounded-xl bg-white p-3 text-xs">
          {JSON.stringify(
            {
              phase: state.phase,
              attempts: state.attempts,
              outcome: state.outcome,
              bucket: state.lastDiagnosis?.bucket,
              errorTile: state.lastDiagnosis?.errorTileIndex,
              streakPenalty: state.streakPenalty,
              firstTryUnassisted: state.firstTryUnassisted,
            },
            null,
            1,
          )}
        </pre>
      )}
    </div>
  )
}

/** Grown-ups' test bench: pick any word and either mode. */
export function BeeStage() {
  const [wordId, setWordId] = useState('word_mysterious')
  const [mode, setMode] = useState<GameMode>('ADVENTURE')
  const [run, setRun] = useState(0)
  const word = WORDS.find((w) => w.id === wordId) ?? WORDS[0]

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <select
          aria-label="Word"
          value={wordId}
          onChange={(e) => setWordId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
        >
          {WORDS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.word} · {w.role}
            </option>
          ))}
        </select>
        <select
          aria-label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as GameMode)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
        >
          <option value="ADVENTURE">Learning Adventure</option>
          <option value="CONTEST">Spelling Bee Contest</option>
        </select>
        <button type="button" onClick={() => setRun((r) => r + 1)} className="underline">
          Restart
        </button>
      </div>
      <JudgeRound key={`${word.id}-${mode}-${run}`} word={word} mode={mode} debug />
    </div>
  )
}
