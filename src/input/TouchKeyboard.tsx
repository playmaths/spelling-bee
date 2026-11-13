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
    <div className="flex flex-col items-center gap-1.5" data-testid="touch-keyboard">
      {ROWS.map((row, r) => (
        <div key={row} className="flex gap-1.5">
          {[...row].map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onLetter(k)}
              className="h-11 w-8 rounded-lg border border-slate-300 bg-white text-lg font-semibold shadow-sm active:bg-amber-100 disabled:opacity-40 sm:h-12 sm:w-11"
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
              className="h-11 w-12 rounded-lg border border-slate-300 bg-slate-100 text-lg shadow-sm active:bg-amber-100 disabled:opacity-40 sm:h-12 sm:w-14"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
