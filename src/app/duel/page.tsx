'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ApiAnime } from '@/lib/types'

type Phase = 'pick' | 'reveal' | 'loading'

export default function DuelPage() {
  const [pair, setPair] = useState<[ApiAnime, ApiAnime] | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [winnerId, setWinnerId] = useState<number | null>(null)
  const [deltas, setDeltas] = useState<Record<number, number>>({})
  const [rounds, setRounds] = useState(0)
  const [error, setError] = useState('')

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
    </main>
  )
}
