import { useEffect, useRef, useState } from 'react'
import type { BeeWord } from '../types/game.ts'
import { IconButton } from '../components/IconButton.tsx'
import { StylusTileCanvas } from './StylusTileCanvas.tsx'
import { TouchKeyboard } from './TouchKeyboard.tsx'
import { acousticGroupOf, readChunk, verifyDictation, type HeardTile } from './speechVerifier.ts'
import type { LetterGuess } from './strokeRecognizer.ts'

type Mode = 'KEYS' | 'WRITE' | 'SAY'

interface Recognition {
  lang: string
  maxAlternatives: number
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onspeechstart: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null
}

/**
 * DICTATION_STREAM: one place where letters arrive by tapping keys, writing with a
 * stylus, or spelling aloud. The slot row sits above whichever input she picks.
 */
export function SpellEntry({
  word,
  letters,
  onChange,
  onSubmit,
  disabled,
  fixedSlots,
  highlight,
}: {
  word: BeeWord
  letters: string
  onChange: (letters: string) => void
  onSubmit: () => void
  disabled?: boolean
  /** Number of slots to show (ADVENTURE). Omit to hide the word's length (CONTEST). */
  fixedSlots?: number
  highlight?: number | null
}) {
  const [mode, setMode] = useState<Mode>('KEYS')
  const [suspects, setSuspects] = useState<HeardTile[]>([])
  const [reading, setReading] = useState<LetterGuess[]>([])
  const [listening, setListening] = useState(false)
  const [micNote, setMicNote] = useState<string | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const state = useRef({ letters, onChange, onSubmit, disabled, pending: suspects.length })
  state.current = { letters, onChange, onSubmit, disabled, pending: suspects.length }

  const append = (l: string) => {
    setReading([])
    onChange(letters + l)
  }
  const backspace = () => {
    setReading([])
    setSuspects((s) => s.filter((t) => t.index < letters.length - 1))
    onChange(letters.slice(0, -1))
  }
  const setTile = (index: number, l: string) => onChange(letters.slice(0, index) + l + letters.slice(index + 1))

  // A physical keyboard always works, whichever input is showing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = state.current
      const el = e.target as HTMLElement | null
      if (s.disabled || e.metaKey || e.ctrlKey || e.altKey) return
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (/^[a-zA-Z]$/.test(e.key)) s.onChange(s.letters + e.key.toUpperCase())
      else if (e.key === 'Backspace') s.onChange(s.letters.slice(0, -1))
      else if (e.key === 'Enter' && s.letters && s.pending === 0) s.onSubmit()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => recognition.current?.stop(), [])

  const listen = () => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      setMicNote('This browser cannot listen. Try tapping the letters or writing them.')
      return
    }
    if (listening) {
      recognition.current?.stop()
      return
    }
    const rec = new Ctor()
    recognition.current = rec
    rec.lang = 'en-US'
    rec.maxAlternatives = 5
    rec.interimResults = false
    // Keep listening while she spells; letters are added as each burst is understood.
    rec.continuous = true
    let mark: number | null = null // when the current burst of speech began
    let handled = 0
    rec.onspeechstart = () => {
      mark ??= Date.now()
    }
    rec.onresult = (e) => {
      for (let i = handled; i < e.results.length; i++) {
        const result = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean }
        if (result.isFinal === false) break
        handled = i + 1
        const nBest = Array.from(result, (alt) => alt.transcript)
        const chunk = readChunk(nBest, mark === null ? null : Date.now() - mark)
        // Later bursts are timed from the previous one, so a pause counts in her favour.
        mark = Date.now()
        if (chunk.kind === 'NOTHING') continue
        if (chunk.kind === 'WORD') {
          setMicNote('That sounded like the whole word. Spell it one letter at a time, like at the bee.')
          continue
        }
        const offset = state.current.letters.length
        const tiles = verifyDictation(word, chunk.transcripts, offset)
        if (tiles.length === 0) continue
        setMicNote(null)
        setSuspects((prev) => [...prev, ...tiles.filter((t) => t.isAsrSuspect)])
        const next = state.current.letters + tiles.map((t) => t.letter).join('')
        state.current.letters = next // several bursts can land before the next render
        state.current.onChange(next)
      }
    }
    rec.onerror = (e) =>
      setMicNote(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? "The microphone is blocked for this page. A grown-up can allow it in the browser's site settings, then tap again. Tapping or writing the letters still works."
          : "I couldn't hear that. Tap the microphone and try again.",
      )
    rec.onend = () => setListening(false)
    try {
      rec.start()
      setListening(true)
      setMicNote(null)
    } catch {
      setMicNote('The microphone is not available here.')
    }
  }

  const slots = fixedSlots ? Math.max(fixedSlots, letters.length) : letters.length + (disabled ? 0 : 1)
  const suspect = suspects[0]

  return (
    <section className="flex w-full flex-col items-center gap-6">
      <div data-testid="tiles" className="flex min-h-14 flex-wrap justify-center gap-2">
        {Array.from({ length: slots }, (_, i) => {
          const fuzzy = suspects.some((t) => t.index === i)
          return (
            <div
              key={i}
              className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 text-2xl font-bold ${
                fuzzy
                  ? 'border-sky-500 bg-sky-100 ring-4 ring-sky-200'
                  : highlight === i
                    ? 'border-amber-500 bg-amber-100 ring-4 ring-amber-200'
                    : fixedSlots && i >= fixedSlots
                      ? 'border-dashed border-slate-300 bg-slate-100'
                      : 'border-slate-300 bg-white'
              }`}
            >
              {letters[i] ?? ''}
            </div>
          )
        })}
      </div>

      {suspect && !disabled && (
        <div data-testid="asr-confirm" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4">
          <p className="mb-2">
            The microphone was a little fuzzy on letter {suspect.index + 1}. Which letter did you say?
          </p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([suspect.letter, ...suspect.alternatives, ...acousticGroupOf(suspect.letter)])].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setTile(suspect.index, l)
                  setSuspects((s) => s.slice(1))
                }}
                className="h-12 w-12 rounded-full border-2 border-sky-500 bg-white text-xl font-bold hover:bg-sky-100"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {!disabled && (
        <>
          <div className="flex items-start justify-center gap-3">
            {(
              [
                ['KEYS', '🔤', 'Tap'],
                ['WRITE', '✍️', 'Write'],
                ['SAY', '🎙️', 'Say'],
              ] as const
            ).map(([m, icon, label]) => (
              <IconButton key={m} icon={icon} label={label} active={mode === m} onClick={() => setMode(m)} />
            ))}
            {mode !== 'KEYS' && (
              <IconButton icon="⌫" label="Undo" onClick={backspace} disabled={!letters} />
            )}
            <button
              type="button"
                            onClick={onSubmit}
              disabled={!letters || suspects.length > 0}
              className="ml-4 rounded-full bg-emerald-500 px-8 py-3 text-xl font-bold text-white shadow-lg disabled:opacity-30"
            >
              Done ✓
            </button>
          </div>

          {mode === 'KEYS' && <TouchKeyboard onLetter={append} onBackspace={backspace} />}

          {mode === 'WRITE' && (
            <div className="flex flex-col items-center gap-2">
              <StylusTileCanvas
                onLetter={(l, guesses) => {
                  onChange(state.current.letters + l)
                  setReading(guesses.slice(0, 4))
                }}
              />
              {reading.length > 1 && (
                <div data-testid="write-fix" className="flex items-center gap-2 text-sm text-slate-600">
                  I read that as <strong className="text-lg text-slate-900">{reading[0].letter}</strong>. Meant
                  something else?
                  {reading.slice(1).map((g) => (
                    <button
                      key={g.letter}
                      type="button"
                      onClick={() => {
                        setTile(letters.length - 1, g.letter)
                        setReading([])
                      }}
                      className="h-9 w-9 rounded-full border-2 border-sky-400 bg-white font-bold"
                    >
                      {g.letter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'SAY' && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={listen}
                className={`rounded-full px-6 py-4 text-lg font-bold text-white ${
                  listening ? 'animate-pulse bg-rose-500' : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {listening ? '🎙️ Listening… tap when you are done' : '🎙️ Tap and spell'}
              </button>
              {micNote && (
                <p data-testid="mic-note" className="rounded-xl bg-amber-100 px-3 py-2 text-sm">
                  {micNote}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
