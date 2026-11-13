import { useState } from 'react'
import { getCard, getPattern } from '../data/index.ts'
import type { BeeWord } from '../types/game.ts'
import { JudgeRound } from './BeeStage.tsx'
import { DetectiveCheck, PuzzlePlay } from './PuzzlePlay.tsx'
import { WordCardFace } from './WordCards.tsx'

type Step = 'PUZZLE' | 'CHECK' | 'CARD'

/**
 * Families whose lesson is how many letters there are (doubling, dropping an E,
 * joining two words) cannot be a fill-the-gap puzzle, because the tiles would give
 * the answer away. Those words are spelled out in full, with coaching.
 */
const SPELL_OUT_KINDS = new Set(['joining-rules', 'prefixes'])
export const spellsOut = (word: BeeWord) => SPELL_OUT_KINDS.has(getPattern(word.patternId)?.kind ?? '')

/** Today's five words, one at a time: puzzle, one "why" question, then the card as the reward. */
export function Play({
  words,
  onResult,
  onHome,
  doneLabel = 'All done for today!',
}: {
  words: BeeWord[]
  onResult: (wordId: string, clean: boolean) => void
  onHome: () => void
  doneLabel?: string
}) {
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>('PUZZLE')
  const [marks, setMarks] = useState<boolean[]>([])
  const [spelled, setSpelled] = useState<boolean | null>(null)

  if (index >= words.length) {
    return (
      <div data-testid="session-done" className="flex flex-col items-center gap-8 pt-16">
        <div className="text-6xl">{marks.map((m) => (m ? '🌸' : '🌱')).join(' ')}</div>
        <p className="text-3xl font-bold">{doneLabel}</p>
        <button type="button" onClick={onHome} className="rounded-full bg-amber-400 px-10 py-4 text-2xl font-bold shadow-lg">
          Done ✓
        </button>
      </div>
    )
  }

  const word = words[index]
  const card = getCard(word.id)
  const next = () => {
    setIndex((i) => i + 1)
    setStep('PUZZLE')
    setSpelled(null)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div data-testid="session-dots" className="flex gap-2 text-xl" aria-label={`Word ${index + 1} of ${words.length}`}>
        {words.map((w, i) => (
          <span key={w.id}>{i < marks.length ? (marks[i] ? '🌸' : '🌱') : i === index ? '🟡' : '⚪'}</span>
        ))}
      </div>

      {step === 'PUZZLE' && !spellsOut(word) && (
        <PuzzlePlay
          key={word.id}
          word={word}
          onDone={(clean) => {
            onResult(word.id, clean)
            setMarks((m) => [...m, clean])
            setStep('CHECK')
          }}
        />
      )}
      {step === 'PUZZLE' && spellsOut(word) && (
        <>
          <JudgeRound
            key={word.id}
            word={word}
            mode="ADVENTURE"
            hideLength
            onResolved={(s) => setSpelled(s.firstTryUnassisted)}
          />
          {spelled !== null && (
            <button
              type="button"
              onClick={() => {
                onResult(word.id, spelled)
                setMarks((m) => [...m, spelled])
                setStep('CHECK')
              }}
              className="rounded-full bg-emerald-500 px-10 py-4 text-2xl font-bold text-white shadow-lg"
            >
              {spelled ? '🌸 ' : ''}Next ▶
            </button>
          )}
        </>
      )}
      {step === 'CHECK' && <DetectiveCheck word={word} onDone={() => setStep(card ? 'CARD' : 'PUZZLE')} />}
      {step === 'CARD' && card && (
        <>
          <WordCardFace key={word.id} word={word} card={card} />
          <button type="button" onClick={next} className="rounded-full bg-emerald-500 px-10 py-4 text-2xl font-bold text-white shadow-lg">
            Next ▶
          </button>
        </>
      )}
    </div>
  )
}
