'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { springFluid } from '@/lib/motion'
import { firstVisibleStep, tooltipPos, tourKey, type TourStep } from '@/lib/tour'

const TIP = { width: 320, height: 150 }

// Oldalankénti első-látogatás spotlight-túra: dim-overlay kivágással a cél-elemen
// (óriás box-shadow trükk) + glass-tooltip. Cél-elemek: [data-tour="<selector>"].
// `force`: a wizard utáni ?tour=1 kényszerített indítása (News).
export default function TourSpotlight({ page, steps, force = false }: {
  page: string
  steps: TourStep[]
  force?: boolean
}) {
  const [idx, setIdx] = useState<number | null>(null)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const rafRef = useRef(0)
  const t = useTranslations('tour')

  const elFor = (selector: string) => document.querySelector<HTMLElement>(`[data-tour="${selector}"]`)

  const finish = useCallback(() => {
    localStorage.setItem(tourKey(page), '1')
    setIdx(null)
  }, [page])

  useEffect(() => {
    if (!force && localStorage.getItem(tourKey(page))) return
    // egy tick, hogy a cél-elemek kirenderelődjenek (kliens-fetch-es szekciók!)
    const t = setTimeout(() => {
      const first = firstVisibleStep(steps, (s) => Boolean(elFor(s)))
      if (first != null) setIdx(first)
    }, 900)
    return () => clearTimeout(t)
  }, [page, steps, force])

  // A túrából billentyűzetről is ki kell lehessen lépni: a Kihagyás gomb
  // egérrel elérhető, de az Escape a megszokott út (§16: sose zárd csapdába).
  useEffect(() => {
    if (idx == null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [idx, finish])

  const measure = useCallback(() => {
    if (idx == null) return
    const el = elFor(steps[idx].selector)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [idx, steps])

  useEffect(() => {
    if (idx == null) return
    const el = elFor(steps[idx].selector)
    // csökkentett mozgásnál a görgetés ugorjon, ne utazzon
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    const t = setTimeout(measure, 450) // scroll után mérünk
    const onMove = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
    }
    // A harmadik argumentum korabban csupasz `true` volt: az useCapture, NEM
    // options — vagyis a listener nem-passziv maradt es blokkolta a gorgetest.
    // Itt a scroll-listener indokolt: a reflektor folyamatos pozicio-kovetest
    // igenyel, amit IntersectionObserver nem ad meg. A rAF-fojtas megvan,
    // es a figyelo csak a nyitott tura alatt el.
    const opts = { capture: true, passive: true } as const
    window.addEventListener('resize', onMove, { passive: true })
    window.addEventListener('scroll', onMove, opts)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, opts)
    }
  }, [idx, measure, steps])

  if (idx == null) return null
  const step = steps[idx]

  function next() {
    const nxt = firstVisibleStep(steps, (s) => Boolean(elFor(s)), idx! + 1)
    if (nxt == null) { finish(); return }
    setRect(null)
    setIdx(nxt)
  }

  const vp = { width: window.innerWidth, height: window.innerHeight }
  const tipAt = rect ? tooltipPos(rect, TIP, vp) : { top: vp.height / 2 - 60, left: vp.width / 2 - TIP.width / 2 }
  // a buborék abból az irányból nő ki, amerre a kiemelt elemhez képest áll
  const originY = rect && tipAt.top < rect.top ? 'bottom' : 'top'
  const originX = rect && tipAt.left < rect.left ? 'right' : 'left'

  return (
    <div className="fixed inset-0 z-[80]" onClick={finish}>
      {rect && (
        // NINCS geometria-átmenet. Korábban `transition-all duration-300` ült
        // rajta, ami a top/left/width/height NÉGY layout-property-jét plusz egy
        // 9999px-es box-shadow-t animált: görgetés közben a kivágás 300ms-mal a
        // kiemelt elem MÖGÖTT kullogott, és minden képkockán újralayoutolt
        // (§1 folyamatos visszajelzés, §11 csak transform/opacity).
        // A lépések közti folytonosságot opacity-átúsztatás adja: a `key` miatt
        // minden lépés új elem, tehát nincs mit interpolálni a geometrián.
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute rounded-2xl"
          style={{
            top: rect.top - 6, left: rect.left - 6,
            width: rect.width + 12, height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
          }}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-black/70" />}
      {/* A buborék eddig lépésenként TELEPORTÁLT, miközben a reflektor mozgott.
          Most transformmal utazik (compositoron), és a kiemelt elemből
          skálázódik ki (§7 térbeli folytonosság, §12 anyagként érkezés). */}
      <motion.div
        className="glass-strong absolute rounded-2xl p-4 flex flex-col gap-2"
        style={{ top: 0, left: 0, width: TIP.width, transformOrigin: `${originY} ${originX}` }}
        initial={{ opacity: 0, scale: 0.96, x: tipAt.left, y: tipAt.top }}
        animate={{ opacity: 1, scale: 1, x: tipAt.left, y: tipAt.top }}
        transition={springFluid}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="label-mono">{step.title}</p>
        <p className="text-sm text-text-1 leading-relaxed">{step.text}</p>
        <div className="flex items-center justify-between mt-1">
          <button onClick={finish} className="text-xs text-text-3 hover:text-text-1">{t('skip')}</button>
          <span className="label-mono text-text-3">{idx + 1}/{steps.length}</span>
          <button onClick={next} className="btn-solid px-4 py-1.5 text-xs">
            {firstVisibleStep(steps, (s) => Boolean(elFor(s)), idx + 1) == null ? t('done') : t('next')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
