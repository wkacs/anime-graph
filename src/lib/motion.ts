import type { Transition, Variants } from 'framer-motion'

// A token-reteg --ease-out-janak JS-megfeleloje (globals.css).
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const REVEAL_TRANSITION: Transition = { duration: 0.45, ease: EASE_OUT }

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
export const posterHover: Transition = { duration: 0.5, ease: EASE_OUT }
