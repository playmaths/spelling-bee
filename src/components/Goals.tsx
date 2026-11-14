import type { GoalState } from '../lib/goals.ts'

/** Today's two goals with their progress, and every sticker she has earned so far. */
export function GoalsScreen({ goals, book }: { goals: GoalState[]; book: string[] }) {
  return (
    <section data-testid="goals" className="flex w-full max-w-md flex-col items-center gap-5">
      <h2 className="text-2xl font-bold text-slate-700">⭐ Today's goals</h2>
      <div className="flex w-full flex-col gap-3">
        {goals.map((s) => (
          <div key={s.goal.id} data-testid="goal" className={`flex items-center gap-3 rounded-3xl p-4 shadow ${s.done ? 'bg-emerald-50' : 'bg-white'}`}>
            <span aria-hidden className="text-3xl">
              {s.goal.icon}
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-lg font-semibold leading-snug text-slate-800">{s.goal.label}</p>
              <div className="flex gap-1.5" aria-label={`${s.have} of ${s.goal.need}`}>
                {Array.from({ length: s.goal.need }, (_, n) => (
                  <span key={n} className={`h-3.5 w-3.5 rounded-full ${n < s.have ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                ))}
              </div>
            </div>
            <span
              aria-label={s.sticker ? 'Sticker earned' : 'A sticker is waiting'}
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl ${
                s.sticker ? 'rotate-6 bg-white shadow-md' : 'border-2 border-dashed border-stone-300 text-2xl text-stone-300'
              }`}
            >
              {s.sticker ?? '?'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-base text-slate-500">New goals tomorrow.</p>
      <h3 className="mt-2 text-xl font-bold text-slate-700">My sticker book</h3>
      {book.length === 0 ? (
        <p className="text-lg text-slate-500">Finish a goal to get your first sticker.</p>
      ) : (
        <div data-testid="sticker-book" className="grid w-full grid-cols-5 gap-3 rounded-3xl bg-white p-4 shadow">
          {book.map((s, n) => (
            <span key={n} className={`flex aspect-square items-center justify-center text-4xl ${n % 3 === 0 ? '-rotate-6' : n % 3 === 1 ? 'rotate-3' : 'rotate-12'}`}>
              {s}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

/** Shown on the home screen when a goal has just paid. Nothing is spoken. */
export function NewSticker({ stickers, onClose }: { stickers: string[]; onClose: () => void }) {
  return (
    <div data-testid="new-sticker" role="dialog" aria-modal className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="flex gap-3 text-7xl">
          {stickers.map((s, n) => (
            <span key={n} className="animate-bounce">
              {s}
            </span>
          ))}
        </div>
        <p className="text-2xl font-bold text-slate-800">{stickers.length > 1 ? 'Two new stickers!' : 'A new sticker!'}</p>
        <p className="text-lg text-slate-600">You finished {stickers.length > 1 ? "today's goals" : 'a goal'}.</p>
        <button type="button" onClick={onClose} className="rounded-full bg-amber-400 px-8 py-3 text-xl font-bold shadow active:scale-95">
          Put it in my book
        </button>
      </div>
    </div>
  )
}
