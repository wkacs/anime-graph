'use client'
import { useEffect, useState } from 'react'
import { formatCountdown } from '@/lib/news'

// live countdown to a unix timestamp (seconds); ticks every second under
// an hour, once a minute above it
export default function Countdown({ airingAt }: { airingAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  const remaining = airingAt - now

  useEffect(() => {
    const interval = remaining < 3600 ? 1000 : 60_000
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), interval)
    return () => clearInterval(t)
  }, [remaining < 3600]) // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining < 3600 && remaining > 0) {
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return <span className="tabular-nums">{`${m}:${String(s).padStart(2, '0')}`}</span>
  }
  return <span className="tabular-nums">{formatCountdown(remaining)}</span>
}
