'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { pickTonight, type TonightMood, type TonightPick, type TonightAnime } from '@/lib/tonight'

const MOODS: { mood: TonightMood; label: string }[] = [
  { mood: 'barmi', label: 'Mindegy, dobj egyet' },
  { mood: 'folytatas', label: 'Folytatnék valamit' },
  { mood: 'rovid', label: 'Valami rövidet' },
  { mood: 'comfort', label: 'Comfort újranézés' },
]

export default function TonightPicker() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TonightAnime[]>([])
  const [pick, setPick] = useState<TonightPick | null>(null)
  const [mood, setMood] = useState<TonightMood>('barmi')

  useEffect(() => {
    if (!open || rows.length) return
    fetch('/api/anime').then((r) => r.json()).then((j) => setRows(j.anime ?? []))
  }, [open, rows.length])

  function roll(m: TonightMood) {
    setMood(m)
    setPick(pickTonight(rows, m))
  }

  async function startWatching() {
    if (!pick) return
    await fetch(`/api/anime/${pick.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'watching' }),
    })
    setOpen(false)
    setPick(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass rounded-full px-4 py-2 text-sm text-text-2 hover:text-text-1 hover:bg-white/8 transition-colors"
      >
        🎲 Ma este mit nézzek?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="glass-strong rounded-3xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="label-mono mb-1">Ma este</p>
              <h2 className="text-lg font-semibold tracking-tight mb-4">Milyen hangulatban vagy?</h2>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {MOODS.map((m) => (
                  <button
                    key={m.mood}
                    onClick={() => roll(m.mood)}
                    className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                      pick && mood === m.mood
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/6 text-text-2 hover:bg-white/12'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {pick ? (
                <motion.div
                  key={pick.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {pick.coverUrl && <img src={pick.coverUrl} alt="" className="w-24 rounded-xl self-start" />}
                  <div className="min-w-0 flex flex-col">
                    <Link href={`/anime/${pick.id}`} className="text-base font-semibold leading-tight hover:underline underline-offset-4 decoration-white/30">
                      {pick.titleRomaji}
                    </Link>
                    <p className="label-mono mt-1">
                      {pick.episodes != null ? `${pick.episodes} rész` : pick.format ?? ''}
                    </p>
                    <p className="text-[13px] text-text-2 leading-snug mt-2">{pick.reason}</p>
                    <div className="flex gap-2 mt-auto pt-3">
                      <button onClick={startWatching} className="btn-solid px-4 py-1.5 text-xs">
                        ▶ Ezt nézem
                      </button>
                      <button onClick={() => roll(mood)} className="btn-ghost border border-white/10 px-3 py-1.5 text-xs">
                        Másikat 🎲
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p className="text-sm text-text-3">Válassz hangulatot, és dobok egyet a listádból.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
