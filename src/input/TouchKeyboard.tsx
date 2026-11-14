const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

/** On-screen letter pad, so the iPad never pops its own keyboard (and its autocorrect). */
export function TouchKeyboard({
  onLetter,
  onBackspace,
  disabled,
}: {
  onLetter: (letter: string) => void
  onBackspace: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-1.5" data-testid="touch-keyboard">
      {ROWS.map((row, r) => (
        <div key={row} className="flex w-full justify-center gap-1 sm:gap-1.5">
          {[...row].map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onLetter(k)}
              className="h-11 w-[calc((100%-2.25rem)/10)] max-w-11 rounded-lg border border-slate-300 bg-white text-lg font-semibold shadow-sm active:bg-amber-100 disabled:opacity-40 sm:h-12"
            >
              {k}
            </button>
          ))}
          {r === 2 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              aria-label="Delete last letter"
              className="h-11 w-[calc((100%-2.25rem)/10*1.5)] max-w-14 rounded-lg border border-slate-300 bg-slate-100 text-lg shadow-sm active:bg-amber-100 disabled:opacity-40 sm:h-12"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
