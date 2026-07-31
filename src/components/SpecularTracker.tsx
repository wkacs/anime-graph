'use client'
import { useEffect } from 'react'

// EGY globális pointermove-listener adja az összes üvegfelület kurzorkövető
// csillanását (.glass-1/2/3 ::before rétege a --mx/--my-ból dolgozik).
// rAF-throttle + proximity-szűrés: csak a kurzor 120px-es körzetében lévő,
// viewportban látható üvegek frissülnek. Touch-eszközön teljesen inaktív.
export default function SpecularTracker() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const glasses = document.querySelectorAll<HTMLElement>('.glass-1, .glass-2, .glass-3')
        for (const el of glasses) {
          const r = el.getBoundingClientRect()
          if (r.bottom < -120 || r.top > window.innerHeight + 120) continue
          if (
            e.clientX < r.left - 120 || e.clientX > r.right + 120 ||
            e.clientY < r.top - 120 || e.clientY > r.bottom + 120
          ) continue
          el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
          el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
        }
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return null
}
