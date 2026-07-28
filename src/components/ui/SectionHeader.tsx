import type { ReactNode } from 'react'

type Props = {
  /** apro mono cimke a cim FELETT — nem a cim helyett */
  eyebrow?: ReactNode
  title: ReactNode
  action?: ReactNode
}

export default function SectionHeader({ eyebrow, title, action }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-mono mb-1.5">{eyebrow}</p>}
        <h2 className="h2 text-text-1">{title}</h2>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  )
}
