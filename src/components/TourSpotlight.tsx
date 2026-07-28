'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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

  useEffect(() => {
    if (!force && localStorage.getItem(tourKey(page))) return
    // egy tick, hogy a cél-elemek kirenderelődjenek (kliens-fetch-es szekciók!)
    const t = setTimeout(() => {
      const first = firstVisibleStep(steps, (s) => Boolean(elFor(s)))
      if (first != null) setIdx(first)
    }, 900)
    return () => clearTimeout(t)
  }, [page, steps, force])

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
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
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
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, opts)
    }
  }, [idx, measure, steps])

  if (idx == null) return null
  const step = steps[idx]

  function finish() {
    localStorage.setItem(tourKey(page), '1')
    setIdx(null)
  }

  function next() {
    const nxt = firstVisibleStep(steps, (s) => Boolean(elFor(s)), idx! + 1)
    if (nxt == null) { finish(); return }
    setRect(null)
    setIdx(nxt)
  }

  const vp = { width: window.innerWidth, height: window.innerHeight }
  const tipAt = rect ? tooltipPos(rect, TIP, vp) : { top: vp.height / 2 - 60, left: vp.width / 2 - TIP.width / 2 }

  return (
    <div className="fixed inset-0 z-[80]" onClick={finish}>
      {rect && (
        <div
          className="absolute rounded-2xl transition-all duration-300"
          style={{
            top: rect.top - 6, left: rect.left - 6,
            width: rect.width + 12, height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
            pointerEvents: 'none',
          }}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-black/70" />}
      <div
        className="glass-strong absolute rounded-2xl p-4 flex flex-col gap-2"
        style={{ top: tipAt.top, left: tipAt.left, width: TIP.width }}
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
      </div>
    </div>
  )
}
