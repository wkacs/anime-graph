import Link from 'next/link'
import type { ReactNode } from 'react'

const VARIANTS = {
  /** mono adat: ev, format, hossz, pontszam.
      text-1: ezek tenyadatok, amiket a hasznalo szemmel keres a fejlecben,
      raadasul a cimoldalon a poszter-ambiens folott ulnek, ahol a hatter
      cimenkent mas. Teljes kontraszt kell. */
  data: 'surface-2 font-mono text-text-1',
  /** mufaj: csak korvonal, masodlagos */
  genre: 'hairline text-text-2',
  /** kattinthato / eldobhato aktiv szuro */
  link: 'hairline text-text-1 hover:border-white/35',
} as const

type Props = {
  children: ReactNode
  variant?: keyof typeof VARIANTS
  href?: string
  title?: string
  /** ha van, egy ✕ jelenik meg a chip vegen */
  onDismiss?: () => void
}

export default function Chip({ children, variant = 'data', href, title, onDismiss }: Props) {
  const cls = `${VARIANTS[variant]} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors`

  if (href) {
    return (
      <Link href={href} title={title} className={`${cls} hover:text-text-1`}>
        {children} <span aria-hidden>→</span>
      </Link>
    )
  }

  if (onDismiss) {
    return (
      <button onClick={onDismiss} title={title} className={cls}>
        {children} <span aria-hidden className="text-text-3">✕</span>
      </button>
    )
  }

  return <span title={title} className={cls}>{children}</span>
}
