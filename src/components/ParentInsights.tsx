import { buildInsights, type FamilyStat } from '../lib/insights.ts'
import type { Progress } from '../lib/unlocks.ts'

const pct = (x: number) => `${Math.round(x * 100)}%`

function Bar({ rate }: { rate: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: pct(rate) }} />
    </div>
  )
}

function Family({ f }: { f: FamilyStat }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{f.title}</span>
        <span className="shrink-0 text-sm text-slate-500 tabular-nums">
          {f.clean} of {f.attempts} first time
        </span>
      </div>
      <Bar rate={f.rate} />
      {f.struggled.length > 0 && <span className="text-sm text-slate-600">Tripped on: {f.struggled.join(', ')}</span>}
    </li>
  )
}

const CARD = 'flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm'

/** For grown-ups: strengths, what to work on, and what to do about it. */
export function ParentInsights({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const i = buildInsights(progress)
  const stat = (value: string, label: string) => (
    <div className="flex flex-col rounded-2xl bg-white p-3 text-center shadow-sm">
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  )

  return (
    <div data-testid="insights" className="flex w-full flex-col gap-5 text-base text-slate-700">
      <button type="button" onClick={onBack} className="self-start font-semibold text-sky-700">
        ◀ Grown-ups
      </button>
      <h2 className="text-2xl font-bold">How she is doing</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat(String(i.wordsSolved), 'words solved')}
        {stat(i.cleanRate === null ? '–' : pct(i.cleanRate), 'right first time')}
        {stat(String(i.daysPlayed), i.daysPlayed === 1 ? 'day played' : 'days played')}
        {stat(i.level === null ? '–' : i.level.toFixed(1), 'word level now (starts at 2.2)')}
      </div>

      <section className={CARD}>
        <h3 className="text-lg font-bold">What to do next</h3>
        <ul data-testid="recommendations" className="flex list-disc flex-col gap-2 pl-5">
          {i.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {i.enough && (
        <>
          <section className={CARD}>
            <h3 className="text-lg font-bold">Going well</h3>
            {i.strengths.length ? (
              <ul className="flex flex-col gap-3">
                {i.strengths.slice(0, 6).map((f) => (
                  <Family key={f.patternId} f={f} />
                ))}
              </ul>
            ) : (
              <p>No family has three or more tries with most right first time yet.</p>
            )}
          </section>

          <section className={CARD}>
            <h3 className="text-lg font-bold">Worth working on</h3>
            {i.focus.length ? (
              <ul className="flex flex-col gap-3">
                {i.focus.slice(0, 6).map((f) => (
                  <Family key={f.patternId} f={f} />
                ))}
              </ul>
            ) : (
              <p>Nothing stands out. A family appears here only after two different words in it went wrong.</p>
            )}
          </section>

          <section className={CARD}>
            <h3 className="text-lg font-bold">By kind of word</h3>
            <ul className="flex flex-col gap-3">
              {i.kinds.map((k) => (
                <li key={k.label} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{k.label}</span>
                    <span className="shrink-0 text-sm text-slate-500 tabular-nums">
                      {pct(k.rate)} of {k.attempts}
                    </span>
                  </div>
                  <Bar rate={k.rate} />
                </li>
              ))}
            </ul>
          </section>

          {i.mistakes.length > 0 && (
            <section className={CARD}>
              <h3 className="text-lg font-bold">Kinds of mistake</h3>
              <p className="text-sm text-slate-500">From words she spelled out in full. Puzzles do not show which kind.</p>
              <ul className="flex flex-col gap-2">
                {i.mistakes.map((m) => (
                  <li key={m.label}>
                    <span className="font-semibold">
                      {m.label} ({m.count})
                    </span>
                    <span className="block text-sm text-slate-600">{m.meaning}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={CARD}>
            <h3 className="text-lg font-bold">Other signs</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>
                Mystery words (never taught): {i.newWords.clean} of {i.newWords.tried} right first time
              </li>
              <li>
                Asked the Judge a question first on {i.asked.times} of {i.asked.of} words
              </li>
              <li>
                Bee stage: {i.stage.correct} of {i.stage.asked} spelled correctly
              </li>
            </ul>
          </section>
        </>
      )}

      <p className="text-sm text-slate-500">
        Based on her last {i.attempts} attempts on this device and any synced with the family code. “Right first time”
        means no help, no lost flowers and no second try.
      </p>
    </div>
  )
}
