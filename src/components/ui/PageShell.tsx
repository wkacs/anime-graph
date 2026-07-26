import type { ReactNode } from 'react'

const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
} as const

type Props = {
  children: ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}

// Egy helyen dol el a lap-konteneres geometria. Korabban 17 oldal irta kulon,
// eltero ertekekkel (max-w-4xl/5xl, pt-24/pt-28).
// A pb-24 md:pb-16 a mobil also tab-sav helyet tartja fonn.
export default function PageShell({ children, width = 'default', className = '' }: Props) {
  return (
    <main className="min-h-screen">
      <div className={`${WIDTHS[width]} mx-auto px-4 pt-24 pb-24 md:pb-16 ${className}`}>
        {children}
      </div>
    </main>
  )
}
