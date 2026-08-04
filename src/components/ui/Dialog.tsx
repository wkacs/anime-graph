'use client'
import { useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalPanel, modalScrim } from '@/lib/motion'

/*
  Kozos modal-burok. Ot helyen allt korabban ugyanaz a csupasz div-par:
  OwnerOverlay, ProfileReveal, TonightPicker, /vibe, /onboarding — es egyik
  sem vitt role="dialog"-ot, fokusz-csapdat vagy Escape-et. Egy billentyuzetes
  hasznalo a fatyol MOGOTT tabolt tovabb, es nem tudott kilepni (§16 wayfinding:
  „hogyan jutok ki?"), mikozben harom kozuluk mozgas nelkul vagott be (§12).

  Amit ad:
  - role="dialog" + aria-modal + aria-labelledby a panelen
  - fokusz a panelre nyitaskor, visszaadas a korabbi elemnek zarasnal
  - Tab koroz a panelen belul, Escape zar
  - body gorgetes-zar (az ELOZO erteket allitja vissza, nem ''-t: a modalok
    egymasra nyilhatnak)
  - egy be/kilepesi ut (§7) es anyagkent erkezo uveg (§12) a motion-tokenekbol
*/

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

type Props = {
  open: boolean
  onClose: () => void
  /** a panelen belul allo cim id-je (ezt kell rateni a h2/h3-ra) */
  labelledBy?: string
  /** ha nincs lathato cim, ez adja a nevet */
  ariaLabel?: string
  /** a panel osztalyai — a hivo dont az anyagrol (glass-strong / surface-menu) */
  panelClassName?: string
  /** a fatyol extra osztalyai (igazitas, padding) */
  scrimClassName?: string
  children: React.ReactNode
}

export default function Dialog({
  open,
  onClose,
  labelledBy,
  ariaLabel,
  panelClassName = 'glass-strong rounded-3xl w-full max-w-md p-6',
  scrimClassName = 'items-center justify-center p-4',
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => onClose(), [onClose])

  // fokusz be es vissza
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    // egy tick, hogy a framer initial utan mar a DOM-ban legyen
    const raf = requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      cancelAnimationFrame(raf)
      restoreRef.current?.focus?.()
    }
  }, [open])

  // Escape + Tab-korozes
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (!items.length) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, close])

  // gorgetes-zar; az ELOZO erteket allitja vissza, mert a modalok stackelhetok
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          {...modalScrim}
          className={`fixed inset-0 z-50 bg-black/60 flex ${scrimClassName}`}
          onClick={close}
        >
          <motion.div
            {...modalPanel}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
            tabIndex={-1}
            className={`outline-none ${panelClassName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** a hivo ezzel keri el a cim id-jet, ha maga akarja kiosztani */
export { FOCUSABLE }
