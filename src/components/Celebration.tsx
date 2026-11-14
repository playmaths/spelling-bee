import { useEffect } from 'react'
import { pickPraise, type Moment } from '../lib/praise.ts'
import { chime } from '../lib/sfx.ts'
import { speak, speakAfter } from '../lib/speak.ts'

const PETALS = [0, 45, 90, 135, 180, 225, 270, 315]
const VISITORS = ['🦋', '🐝', '🐞', '🌈']

/**
 * The moment a word is finished. A clean solve blooms (with a different visitor
 * each time), a helped one opens as a bud, and a miss plants a seedling that will
 * bloom when she gets the word on another day. The line praises what she did.
 */
export function Celebration({
  moment,
  speech,
  children,
}: {
  moment: Moment
  /** NOW: say the praise at once. AFTER: wait for the Judge's verdict to finish first. */
  speech: 'NOW' | 'AFTER'
  children?: React.ReactNode
}) {
  const praise = pickPraise(moment)
  const kind = moment.r === 'CLEAN' ? 'BLOOM' : moment.r === 'HELPED' ? 'GROW' : 'SPROUT'

  useEffect(() => {
    chime(kind)
    if (speech === 'NOW') speak(praise.text, false, praise.clip)
    else speakAfter(praise.text, praise.clip)
    // Once, when the moment appears.
  }, []) // eslint-disable-line

  return (
    <div data-testid="celebration" data-kind={kind} className="flex flex-col items-center gap-4">
      <div className="relative flex h-32 w-32 items-end justify-center" aria-hidden>
        {kind === 'BLOOM' && (
          <>
            {PETALS.map((a) => (
              <span key={a} className="bee-petal absolute left-1/2 top-1/2 -ml-3 -mt-3 text-2xl" style={{ ['--a' as string]: `${a}deg` }}>
                🌸
              </span>
            ))}
            <span className="bee-bloom text-8xl">🌸</span>
            <span className="bee-visitor absolute left-1/2 top-1/2 text-4xl">{VISITORS[Math.abs(moment.seed) % VISITORS.length]}</span>
          </>
        )}
        {kind === 'GROW' && (
          <>
            <span className="bee-bloom text-8xl">🌷</span>
            <span className="bee-sun absolute left-1/2 top-1/2 -ml-4 text-4xl">✨</span>
          </>
        )}
        {kind === 'SPROUT' && (
          <>
            <span className="bee-sun absolute left-1/2 top-1/2 -ml-4 text-4xl">☀️</span>
            <span className="bee-sprout text-8xl">🌱</span>
          </>
        )}
      </div>
      <p data-testid="praise" className="bee-rise max-w-sm text-center text-2xl font-semibold leading-snug text-slate-800">
        {praise.text}
      </p>
      {kind === 'SPROUT' && (
        <p className="bee-rise max-w-sm text-center text-base text-slate-600">It is planted in your garden. It will bloom when you get it another day.</p>
      )}
      <div className="bee-rise">{children}</div>
    </div>
  )
}
