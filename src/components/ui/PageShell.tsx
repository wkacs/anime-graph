import type { ReactNode } from 'react'

const WIDTHS = {
  // egy lepcsofokkal szukebb, mint a narrow: urlap-jellegu oldalak
  // (beallitasok, onboarding, vibe) eddig kezzel irt max-w-2xl-t hasznaltak
  compact: 'max-w-2xl',
  narrow: 'max-w-3xl',
  // a 4xl-t is a rendszer adja: harom oldal irta kulon
  mid: 'max-w-4xl',
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
