'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SEASON_LABELS } from '@/lib/seasonal'

type SeasonItem = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  score: number
  reason: string
}

type SeasonData = {
  season: { season: string; year: number }
  items: SeasonItem[]
  cached: boolean
}

function scoreTone(score: number): string {
  if (score >= 75) return 'var(--status-watching)'
  if (score >= 50) return 'var(--status-completed)'
  return 'var(--status-planned)'
}

export default function SzezonPage() {
  const [data, setData] = useState<SeasonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/szezon', force ? { method: 'POST' } : undefined)
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setData(json)
  }, [])

  useEffect(() => { load() }, [load])

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAdded((s) => new Set(s).add(anilistId))
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-16">
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight">
            Szezon
            {data && (
              <span className="text-text-3 font-normal"> · {data.season.year} {SEASON_LABELS[data.season.season] ?? data.season.season}</span>
            )}
          </h1>
          <p className="text-sm text-text-2 mt-1">
            A szezon animéi az ízlés-profilodon átfuttatva — mennyire való neked.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="btn-ghost border border-white/10 px-4 py-1.5 text-xs"
        >
          Frissítés ↻
        </button>
      </div>

      {loading && (
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="label-mono py-16 text-center"
        >
          A szezon pontozása az ízlésed alapján…
        </motion.p>
      )}
      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {data && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.items.map((it, i) => (
            <motion.article
              key={it.anilistId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
              className="glass rounded-3xl p-4 flex gap-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.coverUrl
                ? <img src={it.coverUrl} alt="" className="w-20 rounded-xl object-cover self-start" />
                : <div className="w-20 aspect-[2/3] rounded-xl bg-white/5 self-start" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-medium leading-tight">{it.title}</h2>
                  <span
                    className="font-mono text-lg font-semibold tabular-nums shrink-0"
                    style={{ color: scoreTone(it.score) }}
                  >
                    {it.score}
                  </span>
                </div>
                <p className="label-mono mt-0.5 mb-1.5">{it.genres.slice(0, 3).join(' · ')}</p>
                <p className="text-[13px] text-text-2 leading-snug">{it.reason}</p>
                <button
                  onClick={() => addToPlanned(it.anilistId)}
                  disabled={added.has(it.anilistId)}
                  className="btn-ghost border border-white/10 mt-2.5 px-3 py-1 text-xs disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                >
                  {added.has(it.anilistId) ? '✓ Tervezem' : '+ Tervezem'}
                </button>
              </div>
            </motion.article>
          ))}
          {data.items.length === 0 && (
            <p className="col-span-full text-sm text-text-3 text-center py-10">
              Nincs pontozható szezonos anime (mind a listádon van már?).
            </p>
          )}
        </div>
      )}
    </main>
  )
}
