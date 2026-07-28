'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatCountdown } from '@/lib/news'

// live countdown to a unix timestamp (seconds); ticks every second under
// an hour, once a minute above it
export default function Countdown({ airingAt }: { airingAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const t = useTranslations('countdown')

  const remaining = airingAt - now

  useEffect(() => {
    const interval = remaining < 3600 ? 1000 : 60_000
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), interval)
    return () => clearInterval(t)
  }, [remaining < 3600]) // eslint-disable-line react-hooks/exhaustive-deps

  // last hour: mint + ticking seconds, so an imminent episode pops out
  if (remaining < 3600 && remaining > 0) {
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return (
      <span className="tabular-nums" style={{ color: 'var(--status-watching)' }}>
        {`${m}:${String(s).padStart(2, '0')}`}
      </span>
    )
  }
  const units = { soon: t('soon'), day: t('day'), hour: t('hour'), minute: t('minute') }
  return <span className="tabular-nums">{formatCountdown(remaining, units)}</span>
}
