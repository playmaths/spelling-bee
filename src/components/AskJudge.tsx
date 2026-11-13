import { useState } from 'react'
import type { JudgeIntent, JudgeLine } from '../engine/judgeStateMachine.ts'
import { IconButton } from './IconButton.tsx'
import { RichText } from './RichText.tsx'

const QUESTIONS: [JudgeIntent, string][] = [
  ['DEFINITION', 'What does it mean?'],
  ['SENTENCE', 'Use it in a sentence'],
  ['SLOW', 'Say it slowly'],
  ['CLUE', 'Give me a clue'],
]

/** One big speaker button. Everything else she can ask opens from "Ask". */
export function AskJudge({ line, onAsk }: { line: JudgeLine; onAsk: (intent: JudgeIntent) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-end gap-6">
        <IconButton icon="🔊" label="Hear the word" size="xl" onClick={() => onAsk('REPEAT')} />
        <IconButton icon="❓" label="Ask" active={open} onClick={() => setOpen((o) => !o)} />
      </div>
      {open && (
        <div className="flex flex-wrap justify-center gap-2">
          {QUESTIONS.map(([intent, label]) => (
            <button
              key={intent}
              type="button"
              onClick={() => {
                onAsk(intent)
                setOpen(false)
              }}
              className="rounded-full bg-white px-4 py-2 font-medium text-slate-700 shadow active:bg-sky-50"
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {line.kind !== 'PROMPT' && (
        <p data-testid="judge-line" className="max-w-md text-center text-xl leading-relaxed text-slate-800">
          <RichText text={line.display} />
        </p>
      )}
    </div>
  )
}
