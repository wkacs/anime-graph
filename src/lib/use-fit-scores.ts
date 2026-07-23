'use client'
import { useEffect, useRef, useState } from 'react'

// Kliens-hook a batch fit-score-hoz: anilistId-halmazra {id: score} map.
// Már lekért id-t nem kér újra; a fetch hibája csendes (badge egyszerűen nem jelenik meg).
export function useFitScores(anilistIds: number[]): Record<number, number> {
  const [scores, setScores] = useState<Record<number, number>>({})
  const requested = useRef<Set<number>>(new Set())

  const key = anilistIds.slice().sort((a, b) => a - b).join(',')

  useEffect(() => {
    const fresh = anilistIds.filter((id) => !requested.current.has(id))
    if (!fresh.length) return
    fresh.forEach((id) => requested.current.add(id))
    fetch('/api/fit/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistIds: fresh }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.scores) setScores((s) => ({ ...s, ...j.scores })) })
      .catch(() => { /* badge nélkül él az oldal */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return scores
}

export function fitColor(score: number): string {
  if (score >= 70) return 'var(--status-watching)'
  if (score >= 45) return 'rgba(255,255,255,0.85)'
  return 'var(--status-dropped)'
}
