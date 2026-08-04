'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { springModal } from '@/lib/motion'

/*
  App-szintu visszajelzes-sav. A §16 negy visszajelzes-fajtajabol a HIBA
  hianyzott teljesen: a lista +1 resz gombja, a bongeszo gyors-hozzaadasa, a
  cim-overlay allapotvezerloi es a fooldali kozos watchlist mind
  `if (res.ok) {...}` mintat kovettek else ag nelkul. Elutasitas eseten a
  hasznalo LITERALISAN semmit nem latott — a szam nem mozdult, uzenet nem
  jott —, amire a termeszetes valasz az ismetelt nyomkodas.

  A sav az undo-toast geometriajat viszi (surface-3 pill, bottom-24 md:bottom-6),
  hogy a ket ertesites egy helyen lakjon.
*/

const EVT = 'anime-graph:toast'

export type ToastTone = 'error' | 'info'

export function notify(message: string, tone: ToastTone = 'error') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVT, { detail: { message, tone } }))
}

type Item = { id: number; message: string; tone: ToastTone }

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    let seq = 0
    function onToast(e: Event) {
      const { message, tone } = (e as CustomEvent<{ message: string; tone: ToastTone }>).detail
      const id = ++seq
      setItems((prev) => [...prev.slice(-2), { id, message, tone }])
      window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 5000)
    }
    window.addEventListener(EVT, onToast)
    return () => window.removeEventListener(EVT, onToast)
  }, [])

  return (
    <div
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {items.map((i) => (
          <motion.div
            key={i.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={springModal}
            className="surface-3 rounded-full px-4 py-2 text-13 max-w-[90vw] text-center"
          >
            <span className={i.tone === 'error' ? 'text-[color:var(--status-dropped)]' : 'text-text-1'}>
              {i.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
