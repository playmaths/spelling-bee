import { useEffect, useRef } from 'react'
import { recognize, type LetterGuess, type Stroke } from './strokeRecognizer.ts'

const SIZE = 220
const PAUSE_MS = 800

/**
 * A writing pad for Apple Pencil, finger or mouse. She writes one letter, pauses,
 * and the recogniser reads it. `allowed` narrows the answer to a puzzle gap's candidates.
 */
export function StylusTileCanvas({
  allowed,
  onLetter,
  disabled,
}: {
  allowed?: readonly string[]
  onLetter: (letter: string, guesses: LetterGuess[]) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const drawing = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef({ allowed, onLetter })
  latest.current = { allowed, onLetter }

  const ctx = () => canvasRef.current?.getContext('2d') ?? null

  const clear = () => {
    window.clearTimeout(timer.current)
    strokes.current = []
    ctx()?.clearRect(0, 0, SIZE, SIZE)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = SIZE * ratio
    canvas.height = SIZE * ratio
    const c = canvas.getContext('2d')
    if (c) {
      c.scale(ratio, ratio)
      c.lineWidth = 7
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.strokeStyle = '#1e293b'
    }
    return () => window.clearTimeout(timer.current)
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * SIZE, ((e.clientY - rect.top) / rect.height) * SIZE]
  }

  const finish = () => {
    const guesses = recognize(strokes.current, latest.current.allowed)
    clear()
    if (guesses.length > 0) latest.current.onLetter(guesses[0].letter, guesses)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        data-testid="write-pad"
        aria-label="Write a letter here"
        style={{ width: SIZE, height: SIZE, touchAction: 'none' }}
        className={`rounded-2xl border-2 border-dashed border-sky-400 bg-white ${disabled ? 'opacity-40' : ''}`}
        onPointerDown={(e) => {
          if (disabled) return
          e.currentTarget.setPointerCapture(e.pointerId)
          window.clearTimeout(timer.current)
          drawing.current = true
          const p = point(e)
          strokes.current.push([p])
          const c = ctx()
          c?.beginPath()
          c?.moveTo(p[0], p[1])
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const p = point(e)
          strokes.current[strokes.current.length - 1].push(p)
          const c = ctx()
          c?.lineTo(p[0], p[1])
          c?.stroke()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          timer.current = window.setTimeout(finish, PAUSE_MS)
        }}
        onPointerCancel={() => {
          drawing.current = false
        }}
      />
      <button type="button" aria-label="Clear the pad" onClick={clear} className="text-sm text-slate-500 underline">
        Clear
      </button>
    </div>
  )
}
