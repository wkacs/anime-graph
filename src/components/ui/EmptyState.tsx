import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  text?: string
  action?: ReactNode
}

export default function EmptyState({ eyebrow, title, text, action }: Props) {
  return (
    <div className="surface-1 rounded-[var(--r-lg)] px-8 py-14 text-center flex flex-col items-center gap-3">
      {eyebrow && <p className="label-mono">{eyebrow}</p>}
      <p className="h2 text-text-1">{title}</p>
      {text && <p className="text-sm text-text-2 max-w-sm leading-relaxed">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
