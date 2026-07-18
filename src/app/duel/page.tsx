'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { ApiAnime } from '@/lib/types'

type Phase = 'pick' | 'reveal' | 'loading'

type DuelStats = {
  top: { animeId: number; title: string; coverUrl: string | null; elo: number; myScore: number | null }[]
  history: { winner: string; loser: string; at: string }[]
}

export default function DuelPage() {
  const [pair, setPair] = useState<[ApiAnime, ApiAnime] | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [winnerId, setWinnerId] = useState<number | null>(null)
  const [deltas, setDeltas] = useState<Record<number, number>>({})
  const [rounds, setRounds] = useState(0)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<DuelStats | null>(null)

  const loadStats = useCallback(() => {
    fetch('/api/duel/stats').then((r) => r.json()).then(setStats).catch(() => { /* opcionális */ })
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const nextPair = useCallback(async () => {
    setPhase('loading')
    setWinnerId(null)
    setDeltas({})
    const res = await fetch('/api/duel')
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setPair(json.pair)
    setPhase('pick')
  }, [])

  useEffect(() => { nextPair() }, [nextPair])

  async function vote(winner: ApiAnime, loser: ApiAnime) {
    if (phase !== 'pick') return
    setWinnerId(winner.id)
    setPhase('reveal')
    const res = await fetch('/api/duel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId: winner.id, loserId: loser.id }),
    })
    if (res.ok) {
      const json = await res.json()
      setDeltas({
        [winner.id]: json.winner.elo - winner.elo,
        [loser.id]: json.loser.elo - loser.elo,
      })
      setRounds((r) => r + 1)
      loadStats()
    }
    setTimeout(nextPair, 1400)
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-3xl px-10 py-12 text-center max-w-md">
          <p className="label-mono mb-2">Duel</p>
          <p className="text-sm text-text-2">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-10">
      <div className="text-center mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Melyik a jobb?</h1>
        <p className="text-sm text-text-2 mt-1">
          Kattints a győztesre — a rangsor beépül az ajánlóba.
        </p>
      </div>

      <div className="flex items-center gap-4 sm:gap-8">
        <AnimatePresence mode="wait">
          {pair && phase !== 'loading' && pair.map((a, i) => {
            const other = pair[i === 0 ? 1 : 0]
            const isWinner = winnerId === a.id
            const isLoser = winnerId != null && !isWinner
            const delta = deltas[a.id]
            return (
              <motion.button
                key={`${a.id}-${rounds}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{
                  opacity: isLoser ? 0.35 : 1,
                  y: 0,
                  scale: isWinner ? 1.04 : 1,
                }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26, delay: phase === 'pick' ? i * 0.08 : 0 }}
                onClick={() => vote(a, other)}
                disabled={phase !== 'pick'}
                className={`glass rounded-3xl p-4 w-[min(42vw,15rem)] text-left transition-colors ${
                  phase === 'pick' ? 'hover:bg-white/10 cursor-pointer' : ''
                } ${isWinner ? 'border-white/40' : ''}`}
              >
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" className="w-full aspect-[2/3] object-cover rounded-2xl" />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-2xl bg-white/5" />
                )}
                <p className="text-sm font-medium leading-tight mt-3">{a.titleRomaji}</p>
                <p className="label-mono mt-1 flex items-center justify-between">
                  <span>{a.year ?? '?'} · {a.format ?? '?'}</span>
                  <AnimatePresence>
                    {delta !== undefined && (
                      <motion.span
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={delta >= 0 ? 'text-[color:var(--status-watching)]' : 'text-[color:var(--status-dropped)]'}
                      >
                        {delta >= 0 ? '+' : ''}{Math.round(delta)} elo
                      </motion.span>
                    )}
                  </AnimatePresence>
                </p>
              </motion.button>
            )
          })}
        </AnimatePresence>
        {phase === 'loading' && (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="label-mono py-24"
          >
            Párosítás…
          </motion.p>
        )}
      </div>

      {pair && phase === 'pick' && (
        <div className="mt-8 flex items-center gap-4">
          <span className="label-mono">{rounds} meccs ebben a körben</span>
          <button onClick={nextPair} className="btn-ghost border border-white/10 px-4 py-1.5 text-xs">
            Kihagyás
          </button>
        </div>
      )}

      {stats && stats.top.length > 0 && (
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-14">
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">Elo-toplista</p>
            <ol className="flex flex-col gap-1.5">
              {stats.top.slice(0, 10).map((t, i) => (
                <li key={t.animeId}>
                  <Link href={`/anime/${t.animeId}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-white/6 transition-colors">
                    <span className="label-mono w-5 text-right">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.coverUrl && <img src={t.coverUrl} alt="" className="w-7 h-9 object-cover rounded" />}
                    <span className="flex-1 min-w-0 text-sm truncate">{t.title}</span>
                    <span className="font-mono text-xs text-text-2 tabular-nums">{t.elo}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">Utolsó meccsek</p>
            {stats.history.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {stats.history.map((h, i) => (
                  <li key={i} className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-text-1">{h.winner}</span>
                    <span className="label-mono shrink-0">›</span>
                    <span className="truncate text-text-3">{h.loser}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-3">Még nem dueleztél.</p>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
