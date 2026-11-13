import type { ReactNode } from 'react'

/** Renders **bold** and *emphasis* segments. */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) =>
    part.startsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : part.startsWith('*') ? (
      <em key={i} className="font-semibold text-amber-700">
        {part.slice(1, -1)}
      </em>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}
