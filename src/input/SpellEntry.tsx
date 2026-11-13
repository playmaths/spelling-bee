import { useEffect, useRef, useState } from 'react'
import type { BeeWord } from '../types/game.ts'
import { IconButton } from '../components/IconButton.tsx'
import { StylusTileCanvas } from './StylusTileCanvas.tsx'
import { TouchKeyboard } from './TouchKeyboard.tsx'
import { acousticGroupOf, parseSpokenLetters, readChunk, verifyDictation, type HeardTile } from './speechVerifier.ts'
import { deleteTile, enterLetter, shiftMarks, type Selection } from './tileEdit.ts'
import type { LetterGuess } from './strokeRecognizer.ts'

type Mode = 'KEYS' | 'WRITE' | 'SAY'

/**
 * A short list to confirm a fuzzy letter: what was heard, what else the microphone
 * offered, the letter the word needs there, and one sound-alike. Never the whole
 * rhyme group (nine buttons is too many), and in alphabetical order so the position
 * gives nothing away.
 */
export function fuzzyChoices(suspect: HeardTile, target: string): string[] {
  const needed = target[suspect.index]?.toUpperCase()
  const picks = [suspect.letter, ...suspect.alternatives, ...(needed ? [needed] : [])]
  const fillers = acousticGroupOf(suspect.letter).filter((l) => !picks.includes(l))
  return [...new Set([...picks, ...fillers])].slice(0, Math.max(4, new Set(picks).size)).slice(0, 4).sort()
}

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
  /** The tile she tapped to fix, if any. */
  const [sel, setSel] = useState<Selection>(null)
  /** Letters heard so far in the burst still being spoken (shown at once, in grey). */
  const [provisional, setProvisional] = useState('')
  const state = useRef({ letters, onChange, onSubmit, disabled, pending: suspects.length, sel })
  state.current = { letters, onChange, onSubmit, disabled, pending: suspects.length, sel }

  /** A letter from the keys, the writing pad or a physical keyboard. */
  const append = (l: string) => {
    const cur = state.current
    setReading([])
    if (cur.sel && cur.sel.index < cur.letters.length) {
      const edit = { kind: cur.sel.insert ? ('INSERT' as const) : ('REPLACE' as const), index: cur.sel.index }
      setSuspects((m) => shiftMarks(m, edit))
    }
    const next = enterLetter(cur.letters, l, cur.sel)
    cur.letters = next
    cur.onChange(next)
    setSel(null)
  }
  /** Removes the selected tile, or the last one. */
  const backspace = () => {
    const cur = state.current
    const index = cur.sel && cur.sel.index < cur.letters.length ? cur.sel.index : cur.letters.length - 1
    if (index < 0) return
    setReading([])
    setSuspects((m) => shiftMarks(m, { kind: 'DELETE', index }))
    const next = deleteTile(cur.letters, index)
    cur.letters = next
    cur.onChange(next)
    setSel(null)
  }
  const setTile = (index: number, l: string) => onChange(letters.slice(0, index) + l + letters.slice(index + 1))

  const keys = useRef({ append, backspace })
  keys.current = { append, backspace }

  // A physical keyboard always works, whichever input is showing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = state.current
      const el = e.target as HTMLElement | null
      if (s.disabled || e.metaKey || e.ctrlKey || e.altKey) return
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (/^[a-zA-Z]$/.test(e.key)) keys.current.append(e.key.toUpperCase())
      else if (e.key === 'Backspace') keys.current.backspace()
      else if (e.key === 'Enter' && s.letters && s.pending === 0) s.onSubmit()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(
    () => () => {
      wantListening.current = false
      recognition.current?.stop()
    },
    [],
  )

  // Many phones and tablets stop listening after every burst of speech. While she
  // has the microphone "on", a session that ends is started again straight away,
  // so she can keep spelling letter by letter until she taps the button.
  const wantListening = useRef(false)
  const quietRestarts = useRef(0)
  const MAX_QUIET_RESTARTS = 6

  const stopListening = () => {
    setProvisional('')
    wantListening.current = false
    recognition.current?.stop()
    setListening(false)
  }

  const startSession = () => {
    const Ctor = recognitionCtor()
    if (!Ctor) return
    const rec = new Ctor()
    recognition.current = rec
    rec.lang = 'en-US'
    rec.maxAlternatives = 5
    // Show letters as they are heard (in grey) instead of waiting for the pause that ends a burst.
    rec.interimResults = true
    rec.continuous = true // honoured on desktop; ignored on many phones, hence the restarts
    let mark: number | null = null // when the current burst of speech began
    let handled = 0
    let heardSomething = false
    rec.onspeechstart = () => {
      mark ??= Date.now()
    }
    rec.onresult = (e) => {
      let stillSpeaking = ''
      for (let i = handled; i < e.results.length; i++) {
        const result = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean }
        if (result.isFinal === false) {
          stillSpeaking += ` ${result[0]?.transcript ?? ''}`
          continue
        }
        if (i !== handled) continue // an earlier burst is still being worked out
        handled = i + 1
        const nBest = Array.from(result, (alt) => alt.transcript)
        const chunk = readChunk(nBest, mark === null ? null : Date.now() - mark)
        // Later bursts are timed from the previous one, so a pause counts in her favour.
        mark = Date.now()
        if (chunk.kind === 'NOTHING') continue
        heardSomething = true
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
      setProvisional(parseSpokenLetters(stillSpeaking).join(''))
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListening.current = false
        setMicNote(
          "The microphone is blocked for this page. A grown-up can allow it in the browser's site settings, then tap again. Tapping or writing the letters still works.",
        )
      }
      // 'no-speech' and 'aborted' are normal between letters; onend decides what happens next.
    }
    rec.onend = () => {
      if (recognition.current !== rec) return
      setProvisional('')
      quietRestarts.current = heardSomething ? 0 : quietRestarts.current + 1
      if (wantListening.current && !state.current.disabled && quietRestarts.current < MAX_QUIET_RESTARTS) {
        window.setTimeout(() => {
          if (wantListening.current) startSession()
        }, 150)
        return
      }
      wantListening.current = false
      setListening(false)
    }
    try {
      rec.start()
    } catch {
      wantListening.current = false
      setListening(false)
      setMicNote('The microphone is not available here.')
    }
  }

  const listen = () => {
    if (!recognitionCtor()) {
      setMicNote('This browser cannot listen. Try tapping the letters or writing them.')
      return
    }
    if (listening) return stopListening()
    wantListening.current = true
    quietRestarts.current = 0
    setListening(true)
    setMicNote(null)
    startSession()
  }

  useEffect(() => {
    if ((disabled || mode !== 'SAY') && wantListening.current) stopListening()
  }, [disabled, mode]) // eslint-disable-line

  const shown = letters.length + provisional.length
  const slots = fixedSlots ? Math.max(fixedSlots, shown) : shown + (disabled ? 0 : 1)
  const suspect = suspects[0]
  const selected = sel && sel.index < letters.length ? sel : null

  return (
    <section className="flex w-full flex-col items-center gap-6">
      <div data-testid="tiles" className="flex min-h-14 flex-wrap justify-center gap-2">
        {Array.from({ length: slots }, (_, i) => {
          const fuzzy = suspects.some((t) => t.index === i)
          const filled = i < letters.length
          const heard = !filled && i < shown
          const chosen = selected?.index === i
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || !filled}
              onClick={() => setSel(chosen ? null : { index: i, insert: false })}
              aria-label={filled ? `Letter ${i + 1}, ${letters[i]}. Tap to change it.` : `Empty box ${i + 1}`}
              aria-pressed={chosen}
              className={`flex h-14 w-12 items-center justify-center rounded-xl border-2 text-2xl font-bold ${
                chosen
                  ? 'border-violet-600 bg-violet-100 ring-4 ring-violet-300'
                  : fuzzy
                    ? 'border-sky-500 bg-sky-100 ring-4 ring-sky-200'
                    : highlight === i
                      ? 'border-amber-500 bg-amber-100 ring-4 ring-amber-200'
                      : heard
                        ? 'border-dashed border-slate-300 bg-white text-slate-400'
                        : fixedSlots && i >= fixedSlots
                          ? 'border-dashed border-slate-300 bg-slate-100'
                          : 'border-slate-300 bg-white'
              }`}
            >
              {filled ? letters[i] : heard ? provisional[i - letters.length] : ''}
            </button>
          )
        })}
      </div>

      {selected && !disabled && (
        <div data-testid="tile-edit" className="flex flex-col items-center gap-3 rounded-2xl bg-violet-50 p-4">
          <p className="text-center font-semibold text-slate-700">
            {selected.insert
              ? `Choose the letter to add before box ${selected.index + 1}.`
              : `Box ${selected.index + 1} is ${letters[selected.index]}. Choose a new letter, or:`}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={backspace}
              className="rounded-full bg-white px-4 py-2 font-semibold text-rose-700 shadow"
            >
              ✕ Take it out
            </button>
            {!selected.insert && (
              <button
                type="button"
                onClick={() => setSel({ index: selected.index, insert: true })}
                className="rounded-full bg-white px-4 py-2 font-semibold text-slate-700 shadow"
              >
                ＋ Add a letter before it
              </button>
            )}
            <button
              type="button"
              onClick={() => setSel(null)}
              className="rounded-full bg-white px-4 py-2 font-semibold text-slate-500 shadow"
            >
              Leave it
            </button>
          </div>
          {mode !== 'KEYS' && <TouchKeyboard onLetter={append} onBackspace={backspace} />}
        </div>
      )}

      {suspect && !disabled && (
        <div data-testid="asr-confirm" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-4">
          <p className="mb-2">
            The microphone was a little fuzzy on letter {suspect.index + 1}. Which letter did you say?
          </p>
          <div className="flex flex-wrap gap-2">
            {fuzzyChoices(suspect, word.word).map((l) => (
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
                  const fixing = state.current.sel !== null
                  append(l)
                  setReading(fixing ? [] : guesses.slice(0, 4))
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
