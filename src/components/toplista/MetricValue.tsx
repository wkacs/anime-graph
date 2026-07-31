'use client'
import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, animate } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { fluidEase } from '@/lib/motion'
import { formatMetric, type LeaderRow } from '@/lib/leaderboard-metric'
import type { LeaderboardTab } from '@/lib/leaderboard'

type Props = {
  row: LeaderRow
  tab: LeaderboardTab
  size: 'lg' | 'md' | 'sm'
}

const NUM = { lg: 'text-2xl', md: 'text-base', sm: 'text-sm' } as const
const SUF = { lg: 'text-lg', md: 'text-xs', sm: 'text-[11px]' } as const
const UNIT = { lg: 'text-xs', md: 'text-[10px]', sm: 'text-[11px]' } as const

// A szám felpörög, amikor a viewportba ér — de CSAK ha numerikus.
// SSR/no-JS a végértéket kapja (a span kezdő tartalma a kész érték),
// az animáció onnan indul 0-ról, így SEO/a11y szempontból veszteségmentes.
function RollingNumber({ value, className }: { value: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const mv = useMotionValue(0)
  const target = Number.parseFloat(value)
  const decimals = value.includes('.') ? (value.split('.')[1]?.length ?? 0) : 0
  const numeric = Number.isFinite(target)

  useEffect(() => {
    if (!inView || !numeric || !ref.current) return
    const ctrl = animate(mv, target, {
      duration: 1.1,
      ease: fluidEase,
      onUpdate: (v) => { if (ref.current) ref.current.textContent = v.toFixed(decimals) },
    })
    return () => ctrl.stop()
  }, [inView, numeric, target, decimals, mv])

  return <span ref={ref} className={className}>{value}</span>
}

// A metrika a toplista létezésének oka, ezért text-1-en áll, nem apró szürkén.
// A százalékjel tapad a számhoz, a szöveges egység nem — és a szöveg a
// nyelvből jön, nem a libből (az nyelvfüggetlen fajtát ad vissza).
export default function MetricValue({ row, tab, size }: Props) {
  const t = useTranslations('leaderboard')
  const m = formatMetric(row, tab)

  const unitText =
    m.unit === 'raters' ? t('raters', { count: m.count ?? 0 })
    : m.unit === 'lists' ? t('onLists')
    : null

  return (
    <p className="whitespace-nowrap text-right">
      <span className={`font-mono tabular-nums text-text-1 ${NUM[size]}`}>
        <RollingNumber value={m.value} className="" />
        {m.unit === 'percent' && <span className={SUF[size]}>%</span>}
      </span>
      {unitText && (
        <span className={`ml-1.5 text-text-2 ${UNIT[size]}`}>{unitText}</span>
      )}
    </p>
  )
}
