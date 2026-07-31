import type { Transition, Variants } from 'framer-motion'

// Közös motion-tokenek — MINDEN animáció innen jön. Inline timing tilos:
// egy ritmus az egész appban (spec: fluid 400-600ms, kilépés rövidebb,
// spring max ~5% túllövéssel — játékos, de prémium).
// A CSS-oldali párja a globals.css --fluid / --dur-* tokenjei.

export const fluidEase: [number, number, number, number] = [0.32, 0.72, 0, 1]

export const springFluid = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 1,
} as const

export const tweenFluid: Transition = { duration: 0.5, ease: fluidEase }
export const tweenExit: Transition = { duration: 0.35, ease: fluidEase }

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: tweenFluid },
}

export const staggerContainer = (delay = 0.08): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
})

export const cardHover = { y: -4, scale: 1.015, transition: springFluid } as const
export const tapScale = { scale: 0.97 } as const
export const viewportOnce = { once: true, amount: 0.2 } as const

/* ── örökölt API (FollowedRow, SeasonGrid) — a fluid görbére kötve ── */

// A token-reteg --ease-out-janak JS-megfeleloje (globals.css).
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const REVEAL_TRANSITION: Transition = { duration: 0.45, ease: fluidEase }

/** viewport-triggerelt belepes racs-elemeknek; a stagger az indexbol jon */
export function reveal(index = 0, maxDelay = 0.3) {
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' } as const,
    transition: { ...REVEAL_TRANSITION, delay: Math.min(index * 0.03, maxDelay) },
  }
}

/** egyszeri belepes szekciora / panelre, index nelkul */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: REVEAL_TRANSITION },
}

/** poszter-hover: a MediaCard borito-nagyitasanak CSS-parja JS-oldalon */
export const posterHover: Transition = { duration: 0.5, ease: fluidEase }
