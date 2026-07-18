'use client'
import { useState } from 'react'
import type { RecCandidate } from '@/lib/anilist'

type PickResult = RecCandidate & { reason: string }

export default function RecommendModal({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<PickResult[]>([])
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())

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
    <>
      <button
        onClick={run}
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-2.5 font-bold text-slate-950 shadow-lg shadow-cyan-500/30 hover:brightness-110"
      >
        ✨ Recommend me
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] w-[min(90vw,42rem)] overflow-y-auto rounded-2xl bg-slate-950 border border-slate-700 p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Ajánlások neked</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            {loading && <p className="text-cyan-400 animate-pulse">Az ízlésed elemzése…</p>}
            {error && <p className="text-red-400">{error}</p>}
            <ul className="flex flex-col gap-3">
              {picks.map((p) => (
                <li key={p.anilistId} className="flex gap-3 rounded-xl bg-slate-900 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="w-16 rounded-lg self-start" />}
                  <div className="flex-1">
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-xs text-slate-500 mb-1">{p.genres.join(', ')} · AniList {p.avgScore ?? '?'}</p>
                    <p className="text-sm text-slate-300">{p.reason}</p>
                  </div>
                  <button
                    onClick={() => addToPlanned(p.anilistId)}
                    disabled={added.has(p.anilistId)}
                    className="self-start rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs disabled:text-emerald-400"
                  >
                    {added.has(p.anilistId) ? '✓ Tervezem' : '+ Tervezem'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
