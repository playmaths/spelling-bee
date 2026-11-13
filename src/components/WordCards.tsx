import { useState } from 'react'
import { CARDS, getWord } from '../data/index.ts'
import { clipKeys } from '../lib/clips.ts'
import { speak } from '../lib/speak.ts'
import { LEVEL_FLOOR } from '../lib/unlocks.ts'
import type { BeeWord, WordCard } from '../types/game.ts'
import { RichText } from './RichText.tsx'

/** The word with its hidden hook picked out, e.g. pract-ICE. */
function HookedWord({ word, hook }: { word: string; hook: string }) {
  const at = word.indexOf(hook)
  if (at < 0) return <>{word}</>
  return (
    <>
      {word.slice(0, at)}
      <span className="rounded bg-amber-200 px-0.5 text-amber-800">{hook}</span>
      {word.slice(at + hook.length)}
    </>
  )
}

export function WordCardFace({ word, card }: { word: BeeWord; card: WordCard }) {
  const [story, setStory] = useState(false)
  const parts = [...new Set(word.meanings.map((m) => m.partOfSpeech))]
  return (
    <article
      data-testid="word-card"
      className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl border-2 border-stone-200 bg-[#fbf8ef] p-6 shadow-lg"
    >
      <h3 className="text-4xl font-bold tracking-tight text-slate-800">
        <HookedWord word={word.word} hook={card.hook} />
      </h3>
      <p className="text-sm text-slate-500">
        {parts.join(', ')} <span className="mx-1 text-slate-300">|</span> {word.phoneticRespelling}
        <button
          type="button"
          onClick={() => speak(word.word, false, clipKeys.word(word.word))}
          aria-label="Hear the word"
          className="ml-2 rounded-full bg-white px-2 py-0.5 shadow-sm"
        >
          🔊
        </button>
      </p>
      <ol className="list-inside list-decimal space-y-1 text-lg font-semibold leading-snug text-slate-800">
        {word.meanings.map((m, i) => (
          <li key={i}>
            <span className="font-normal text-slate-500">({m.partOfSpeech})</span> {m.kidDefinition}
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-500">{card.synonyms.join(', ')}</p>
      <div
        aria-hidden
        className="flex h-36 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-100 to-emerald-50 text-6xl"
      >
        {card.emoji}
      </div>
      <p className="text-center text-lg font-medium leading-snug text-slate-700">
        <RichText text={card.sentence} />
      </p>
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => speak(card.sentence, false, clipKeys.card(word.word))}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow"
        >
          🔊 Read it to me
        </button>
        <button
          type="button"
          aria-expanded={story}
          onClick={() => {
            if (!story) speak(word.wordStory)
            setStory((v) => !v)
          }}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold shadow"
        >
          📖 Its story
        </button>
      </div>
      {story && (
        <p data-testid="word-story" className="rounded-2xl bg-white p-4 text-slate-700">
          {word.wordStory}
        </p>
      )}
    </article>
  )
}

export function WordCards({ unlockAll, collected }: { unlockAll: boolean; collected: string[] }) {
  // Quarantine: a transfer-probe card is only in the deck once its puzzle has been met.
  // Easiest first, so a casual flip-through starts with words she can read.
  const deck = CARDS.map((card) => ({ card, word: getWord(card.wordId)! }))
    .filter(({ word }) => word.difficulty >= LEVEL_FLOOR || collected.includes(word.id))
    .filter(({ word }) => word.role !== 'TRANSFER_PROBE' || unlockAll || collected.includes(word.id))
    .sort((a, b) => a.word.difficulty - b.word.difficulty)
  const [current, setCurrent] = useState(0)
  const shown = deck[current % deck.length]
  const step = (d: number) => setCurrent((c) => (c + d + deck.length) % deck.length)
  const arrow = 'h-14 w-14 shrink-0 rounded-full bg-white text-2xl shadow active:scale-95'

  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" aria-label="Previous card" onClick={() => step(-1)} className={arrow}>
        ◀
      </button>
      <WordCardFace key={shown.word.id} word={shown.word} card={shown.card} />
      <button type="button" aria-label="Next card" onClick={() => step(1)} className={arrow}>
        ▶
      </button>
    </div>
  )
}
