import { useState } from 'react'
import { clipKeys } from '../lib/clips.ts'
import { buildMeaningRound, type MeaningQuestion } from '../lib/meanings.ts'
import { chime } from '../lib/sfx.ts'
import { speak } from '../lib/speak.ts'
import { IconButton } from './IconButton.tsx'

const article = (pos: string) => (/^[aeiou]/.test(pos) ? 'an' : 'a')

/**
 * "Which word?": one meaning, four words. A wrong pick fades and she tries again;
 * nothing is spoken until she taps. No timer and no score, only how many she knew first go.
 */
export function MeaningQuiz({
  solved,
  unlockAll,
  target,
  onHome,
  onFound,
}: {
  solved: Record<string, unknown>
  unlockAll: boolean
  target: number
  onHome: () => void
  /** She found a word (on any try); counts toward the day's goals. */
  onFound: () => void
}) {
  const newRound = () => buildMeaningRound(solved, unlockAll, target, Math.floor(Math.random() * 1e6))
  const [round, setRound] = useState<MeaningQuestion[]>(newRound)
  const [at, setAt] = useState(0)
  const [wrong, setWrong] = useState<string[]>([])
  const [found, setFound] = useState(false)
  const [firstGo, setFirstGo] = useState(0)

  if (at >= round.length) {
    return (
      <section data-testid="meaning-done" className="flex flex-1 flex-col items-center justify-center gap-6 pb-16 text-center">
        <div className="text-7xl">📚</div>
        <h2 className="text-3xl font-bold">
          You knew {firstGo} of {round.length} first go!
        </h2>
        <p className="text-lg text-slate-600">Every word you meet here is one more you own.</p>
        <div className="flex gap-8">
          <IconButton
            icon="🔁"
            label="More words"
            size="lg"
            onClick={() => {
              setRound(newRound())
              setAt(0)
              setWrong([])
              setFound(false)
              setFirstGo(0)
            }}
          />
          <IconButton icon="🏠" label="Home" size="lg" onClick={onHome} />
        </div>
      </section>
    )
  }

  const q = round[at]
  const m = q.word.meanings[q.meaning]
  const pick = (choice: string) => {
    if (found || wrong.includes(choice)) return
    if (choice === q.word.word) {
      setFound(true)
      onFound()
      if (wrong.length === 0) setFirstGo((n) => n + 1)
      chime(wrong.length === 0 ? 'BLOOM' : 'GROW')
    } else {
      setWrong((w) => [...w, choice])
    }
  }

  return (
    <section data-testid="meaning-quiz" className="flex w-full max-w-md flex-1 flex-col items-center gap-3 sm:gap-5">
      <div className="flex gap-2" aria-label={`Word ${at + 1} of ${round.length}`}>
        {round.map((_, n) => (
          <span key={n} className={`h-3 w-3 rounded-full ${n < at ? 'bg-amber-400' : n === at ? 'bg-slate-700' : 'bg-stone-300'}`} />
        ))}
      </div>
      <h2 className="text-xl font-bold text-slate-700 sm:text-2xl">Which word means this?</h2>
      <div className="flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow sm:gap-3 sm:p-5">
        <p data-testid="meaning-text" className="text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
          {m.kidDefinition}
        </p>
        <button
          type="button"
          onClick={() => speak(`It's ${article(m.partOfSpeech)} ${m.partOfSpeech}. ${m.kidDefinition}`, false, clipKeys.definition(q.word.word, q.meaning))}
          className="rounded-full bg-amber-100 px-4 py-1.5 text-base font-semibold shadow-sm"
        >
          🔊 Read it to me
        </button>
      </div>
      <div className="flex w-full flex-col gap-2 sm:gap-3">
        {q.choices.map((c) => {
          const right = found && c === q.word.word
          const out = wrong.includes(c)
          return (
            <button
              key={c}
              type="button"
              data-testid="meaning-choice"
              disabled={out || (found && !right)}
              onClick={() => pick(c)}
              className={`rounded-2xl px-4 py-2.5 text-xl font-bold shadow sm:py-4 sm:text-2xl active:scale-[0.98] ${
                right ? 'bg-emerald-400 text-white' : out ? 'bg-stone-200 text-stone-400 line-through' : found ? 'bg-white text-slate-400' : 'bg-white text-slate-800'
              }`}
            >
              {c}
            </button>
          )
        })}
      </div>
      {/* One row, always the same height, so nothing jumps and Next never falls off a phone screen. */}
      <div className="flex min-h-20 w-full items-center justify-between gap-3">
        <p aria-live="polite" className="flex-1 text-lg font-semibold leading-snug text-slate-600">
          {found ? (wrong.length === 0 ? 'Yes! You knew it.' : 'Yes! That is the one.') : wrong.length > 0 ? 'Not that one. Have another look.' : ''}
        </p>
        {found && (
          <div className="flex gap-4">
            <IconButton icon="🔊" label="Hear it" onClick={() => speak(q.word.word, false, clipKeys.word(q.word.word))} />
            <IconButton
              icon="➡️"
              label={at + 1 === round.length ? 'Finish' : 'Next'}
              onClick={() => {
                setAt((n) => n + 1)
                setWrong([])
                setFound(false)
              }}
            />
          </div>
        )}
      </div>
    </section>
  )
}
