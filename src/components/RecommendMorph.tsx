'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RecCandidate } from '@/lib/anilist'

type PickResult = RecCandidate & { reason: string }

const spring = { type: 'spring' as const, stiffness: 300, damping: 32 }

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

export default function RecommendMorph({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<PickResult[]>([])
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [explaining, setExplaining] = useState(false)
  const [explainNote, setExplainNote] = useState('')

  // A rangsor lokalis (fit-vektor). Ez a gomb EGY AI-hivast inditi, es CSAK az
  // indoklas szoveget csereli le — hiba eseten a lista es a lokalis indoklas marad.
  async function explain() {
    setExplaining(true)
    setExplainNote('')
    try {
      const res = await fetch('/api/recommend/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picks: picks.map((p) => ({ anilistId: p.anilistId, title: p.title, genres: p.genres, coverUrl: p.coverUrl, avgScore: null })),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setExplainNote(json?.error ?? 'Most nem sikerült bővebb indoklás')
        return
      }
      const byId = new Map<number, string>(
        (json.picks as { anilistId: number; reason: string }[]).map((p) => [p.anilistId, p.reason]),
      )
      setPicks((prev) => prev.map((p) => ({ ...p, reason: byId.get(p.anilistId) ?? p.reason })))
    } catch {
      setExplainNote('Most nem sikerült bővebb indoklás')
    } finally {
      setExplaining(false)
    }
  }

  async function run() {
    setOpen(true)
    setLoading(true)
    setError('')
    setPicks([])
    const res = await fetch('/api/recommend', { method: 'POST' })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setPicks(json.picks)
  }

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) {
      setAdded((s) => new Set(s).add(anilistId))
      onAdded()
    }
  }

  return (
    <motion.div
      layout
      transition={spring}
      style={{ borderRadius: 22 }}
      className={`glass-strong overflow-hidden ${open ? '' : 'cta-glow'}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!open ? (
          <motion.button
            key="pill"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={run}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2.5 text-sm font-medium text-text-1 whitespace-nowrap"
          >
            ✦ Ajánlj nekem
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-[min(88vw,25rem)] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <p className="label-mono">Ajánló</p>
                <h2 className="text-base font-semibold tracking-tight">Neked válogatva</h2>
              </div>
              <div className="flex items-center gap-1">
                {!loading && (
                  <button onClick={run} className="btn-ghost px-2.5 py-1 text-xs" title="Új ajánlás">↻</button>
                )}
                <button onClick={() => setOpen(false)} className="btn-ghost px-2.5 py-1 text-xs">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[62vh] px-3 pb-3">
              {loading && (
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="label-mono px-2 py-6 text-center"
                >
                  Az ízlésed elemzése…
                </motion.p>
              )}
              {error && <p className="text-sm text-[color:var(--status-dropped)] px-2 py-4">{error}</p>}
              <motion.ul variants={listVariants} initial="hidden" animate={picks.length ? 'show' : 'hidden'} className="flex flex-col gap-2">
                {picks.map((p) => (
                  <motion.li
                    key={p.anilistId}
                    variants={itemVariants}
                    className="flex gap-3 rounded-2xl bg-white/4 border border-white/6 p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.coverUrl && <img src={p.coverUrl} alt="" className="w-12 rounded-lg self-start" />}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium leading-tight">{p.title}</h3>
                      <p className="label-mono mt-0.5 mb-1">{p.genres.slice(0, 3).join(' · ')}</p>
                      <p className="text-[13px] text-text-2 leading-snug">{p.reason}</p>
                    </div>
                    <button
                      onClick={() => addToPlanned(p.anilistId)}
                      disabled={added.has(p.anilistId)}
                      className="btn-ghost self-start px-2.5 py-1 text-xs border border-white/10 whitespace-nowrap disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                    >
                      {added.has(p.anilistId) ? '✓' : '+ Tervezem'}
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
              {picks.length > 0 && (
                <div className="px-2 pt-2">
                  <button
                    onClick={explain}
                    disabled={explaining}
                    className="btn-ghost px-3 py-1.5 text-xs border border-white/10"
                  >
                    {explaining ? '…' : 'Mondd el bővebben'}
                  </button>
                  {explainNote && <p className="text-xs text-text-3 mt-1">{explainNote}</p>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
