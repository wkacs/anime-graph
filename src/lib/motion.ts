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

// Modálok / fiókok / felugró menük. csillapítási arány ≈ 0,84, válaszidő
// ≈ 0,35s — az Apple „drawer/sheet: damping 0,8 / response 0,3" sora.
// A TonightPicker már ezt hozta inline; itt tokenné vált, mert öt további
// felület ugyanilyen, és eddig mindegyik MOZGÁS NÉLKÜL vágott be.
export const springModal = { type: 'spring', stiffness: 320, damping: 30 } as const

// A modál-panel be/kilépése EGY úton jár (§7), és a blur+scale együtt mozdul,
// hogy az üveg anyagként érkezzen, ne sima opacity-fade legyen (§12).
export const modalScrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25, ease: fluidEase },
} as const

export const modalPanel = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 12 },
  transition: springModal,
} as const

// Felugró menü: a triggerből nő ki, oda is húzódik vissza. A transform-origin
// hívási helyenként dől el (jobb felül / jobb alul), ezért nincs benne.
export const popMenu = {
  initial: { opacity: 0, scale: 0.94, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: -6 },
  transition: springModal,
} as const

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
