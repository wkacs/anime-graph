'use client'
import { useTranslations } from 'next-intl'
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
        {m.value}
        {m.unit === 'percent' && <span className={SUF[size]}>%</span>}
      </span>
      {unitText && (
        <span className={`ml-1.5 text-text-2 ${UNIT[size]}`}>{unitText}</span>
      )}
    </p>
  )
}
