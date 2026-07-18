'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { ApiAnime } from '@/lib/types'

type OwnPick = { animeId: number; title: string; coverUrl: string | null; genres: string[]; status: string; reason: string }
type NewPick = {
  title: string
  reason: string
  anilistId: number | null
  coverUrl: string | null
  year: number | null
  genres: string[]
}

export default function VibePage() {
  const [list, setList] = useState<ApiAnime[]>([])
  const [prompt, setPrompt] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQ, setPickerQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ownPicks, setOwnPicks] = useState<OwnPick[]>([])
  const [newPicks, setNewPicks] = useState<NewPick[]>([])
  const [ran, setRan] = useState(false)
  const [addedNew, setAddedNew] = useState<Set<number>>(new Set())

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAddedNew((s) => new Set(s).add(anilistId))
  }

  useEffect(() => {
    fetch('/api/anime').then((r) => r.json()).then((j) => setList(j.anime ?? []))
  }, [])

  const pickerRows = useMemo(() => {
    const needle = pickerQ.trim().toLowerCase()
    return list.filter((a) => !needle || a.titleRomaji.toLowerCase().includes(needle))
  }, [list, pickerQ])

  const selectedAnime = list.filter((a) => selected.has(a.id))

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function run() {
    setLoading(true)
    setError('')
    setOwnPicks([])
    setNewPicks([])
    const res = await fetch('/api/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, animeIds: [...selected] }),
    })
    const json = await res.json()
    setLoading(false)
    setRan(true)
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setOwnPicks(json.ownPicks ?? [])
    setNewPicks(json.newPicks ?? [])
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vibe-keresés</h1>
        <p className="text-sm text-text-2 mt-1">
          Írd le, mire vágysz — a kiválasztott animék fixen bemennek kontextusnak, akkor is, ha a szövegben nem említed őket.
        </p>
      </div>

      <section className="glass rounded-3xl p-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="pl. olyat mint a Steins;Gate, de rövidebb és kevésbé nyomasztó…"
          className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {selectedAnime.map((a) => (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className="flex items-center gap-1.5 rounded-full bg-white/8 border border-white/10 pl-1 pr-2.5 py-1 text-xs hover:bg-white/12 transition-colors"
              title="Eltávolítás"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.coverUrl && <img src={a.coverUrl} alt="" className="w-5 h-7 object-cover rounded" />}
              {a.titleRomaji}
              <span className="text-text-3">✕</span>
            </button>
          ))}
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-full border border-dashed border-white/20 px-3 py-1.5 text-xs text-text-2 hover:text-text-1 hover:border-white/40 transition-colors"
          >
            + Anime a listádból
          </button>
          <button
            onClick={run}
            disabled={loading || (!prompt.trim() && selected.size === 0)}
            className="btn-solid ml-auto px-5 py-2 text-sm"
          >
            {loading ? 'Keresés…' : 'Keresés'}
          </button>
        </div>
      </section>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {newPicks.length > 0 && (
        <section>
          <p className="label-mono mb-2">Új felfedezés — nincs a listádon</p>
          <ul className="flex flex-col gap-2">
            {newPicks.map((p) => (
              <li key={`${p.title}-${p.anilistId ?? 'x'}`} className="glass rounded-2xl p-3 flex gap-3">
                {p.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" className="w-12 rounded-lg self-start" />
                ) : (
                  <div className="w-12 aspect-[2/3] rounded-lg bg-white/5 self-start" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-medium leading-tight">{p.title}</h3>
                    {p.anilistId != null ? (
                      <button
                        onClick={() => addToPlanned(p.anilistId!)}
                        disabled={addedNew.has(p.anilistId)}
                        className="btn-ghost border border-white/10 px-2.5 py-1 text-xs whitespace-nowrap shrink-0 disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                      >
                        {addedNew.has(p.anilistId) ? '✓ Tervezem' : '+ Tervezem'}
                      </button>
                    ) : (
                      <a
                        href={`https://anilist.co/search/anime?search=${encodeURIComponent(p.title)}`}
                        target="_blank" rel="noreferrer"
                        className="label-mono hover:text-text-1 whitespace-nowrap shrink-0"
                      >AniList ↗</a>
                    )}
                  </div>
                  {(p.year != null || p.genres.length > 0) && (
                    <p className="label-mono mt-0.5">
                      {[p.year, ...p.genres.slice(0, 3)].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-[13px] text-text-2 leading-snug mt-1">{p.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ownPicks.length > 0 && (
        <section>
          <p className="label-mono mb-2">Hasonlók a listádból — ilyesmit már ismersz</p>
          <ul className="flex flex-col gap-2">
            {ownPicks.map((p) => (
              <li key={p.animeId}>
                <Link href={`/anime/${p.animeId}`} className="glass rounded-2xl flex gap-3 p-3 hover:bg-white/8 transition-colors opacity-80 hover:opacity-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="w-10 rounded-lg self-start" />}
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">{p.title}</h3>
                    <p className="label-mono mt-0.5 mb-1">{p.genres.slice(0, 3).join(' · ')}</p>
                    <p className="text-[13px] text-text-2 leading-snug">{p.reason}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ran && !loading && !error && ownPicks.length === 0 && newPicks.length === 0 && (
        <p className="text-sm text-text-3">Nincs találat — próbáld pontosabban leírni.</p>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="glass-strong rounded-3xl w-full max-w-lg max-h-[70vh] flex flex-col p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <input
                  value={pickerQ}
                  onChange={(e) => setPickerQ(e.target.value)}
                  placeholder="Keresés a listádban…"
                  className="field flex-1 rounded-full px-4 py-2 text-sm"
                  autoFocus
                />
                <button onClick={() => setPickerOpen(false)} className="btn-ghost px-3 py-1.5 text-sm">Kész</button>
              </div>
              <div className="overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pickerRows.map((a) => {
                  const isSel = selected.has(a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`relative rounded-xl overflow-hidden border transition-colors text-left ${
                        isSel ? 'border-white/70' : 'border-white/8 hover:border-white/25'
                      }`}
                    >
                      {a.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.coverUrl} alt="" className="w-full aspect-[2/3] object-cover" />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-white/5" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pt-5 pb-1.5 text-[11px] leading-tight">
                        {a.titleRomaji}
                      </span>
                      {isSel && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white text-black text-xs flex items-center justify-center">✓</span>
                      )}
                    </button>
                  )
                })}
                {pickerRows.length === 0 && (
                  <p className="col-span-full text-center text-sm text-text-3 py-6">Nincs találat.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
