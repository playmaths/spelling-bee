/** A round icon with a short word under it, so nothing has to be guessed. */
export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  size = 'md',
}: {
  icon: string
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  size?: 'md' | 'lg' | 'xl'
}) {
  const circle = { md: 'h-14 w-14 text-2xl', lg: 'h-20 w-20 text-4xl', xl: 'h-24 w-24 text-5xl' }[size]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="flex flex-col items-center gap-1 disabled:opacity-40"
    >
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-full shadow active:scale-95 ${circle} ${
          active ? 'bg-slate-800' : size === 'xl' ? 'bg-sky-500 shadow-lg' : 'bg-white'
        }`}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
    </button>
  )
}
