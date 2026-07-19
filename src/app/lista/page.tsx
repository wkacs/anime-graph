'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import { filterByMedia, type MediaMode } from '@/lib/graph-builder'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime } from '@/lib/types'

type SortKey = 'titleRomaji' | 'year' | 'studio' | 'status' | 'myScore'

const FILTERS = ['all', 'watching', 'completed', 'planned', 'dropped'] as const

const MEDIA_MODES: { value: MediaMode; label: string }[] = [
  { value: 'ANIME', label: 'Anime' },
  { value: 'MANGA', label: 'Manga' },
  { value: 'ALL', label: 'Mind' },
]

export default function ListaPage() {
  const [list, setList] = useState<ApiAnime[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [mediaMode, setMediaMode] = useState<MediaMode>('ANIME')
  const [sortKey, setSortKey] = useState<SortKey>('titleRomaji')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const router = useRouter()

  const reload = useCallback(() => {
    fetch('/api/anime').then((r) => r.json()).then((j) => setList(j.anime ?? []))
  }, [])

  useEffect(() => { reload() }, [reload])

  // törlés utáni undo-toast (a detail-oldal teszi be a sessionStorage-ba)
  const [undoBundle, setUndoBundle] = useState<{ anime: { titleRomaji: string } } | null>(null)
  useEffect(() => {
    const raw = sessionStorage.getItem('anime-graph-undo')
    if (!raw) return
    sessionStorage.removeItem('anime-graph-undo')
    try { setUndoBundle(JSON.parse(raw)) } catch { return }
    const t = setTimeout(() => setUndoBundle(null), 8000)
    return () => clearTimeout(t)
  }, [])

  async function undoDelete() {
    if (!undoBundle) return
    const res = await fetch('/api/anime/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle: undoBundle }),
    })
    setUndoBundle(null)
    if (res.ok) reload()
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(1) }
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return filterByMedia(list, mediaMode)
      .filter((a) => filter === 'all' || a.status === filter)
      .filter((a) =>
        !needle ||
        a.titleRomaji.toLowerCase().includes(needle) ||
        (a.titleEnglish ?? '').toLowerCase().includes(needle))
      .sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir
      })
  }, [list, q, filter, sortKey, sortDir, mediaMode])

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2.5 text-left ${className}`}>
      <button onClick={() => sortBy(k)} className="label-mono hover:text-text-1 transition-colors">
        {children}{sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-16">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold tracking-tight mr-auto">Lista</h1>
        <AddAnimeSearch onAdded={() => reload()} />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {MEDIA_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMediaMode(m.value)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                mediaMode === m.value ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === f ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1 hover:bg-white/5'
              }`}
            >
              {f === 'all' ? 'Mind' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Keresés…"
          className="field rounded-full px-4 py-2 text-sm w-52"
        />
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              <th className="w-14" />
              <Th k="titleRomaji">Cím</Th>
              <Th k="year" className="hidden sm:table-cell">Év</Th>
              <Th k="studio" className="hidden md:table-cell">Stúdió</Th>
              <Th k="status">Státusz</Th>
              <Th k="myScore" className="text-right">Pont</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/anime/${a.id}`)}
                className="border-b border-white/5 last:border-0 hover:bg-white/4 cursor-pointer transition-colors"
              >
                <td className="pl-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.coverUrl && <img src={a.coverUrl} alt="" className="w-9 h-12 object-cover rounded-md" />}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium leading-tight">{a.titleRomaji}</p>
                  {a.titleNative && <p className="text-[11px] text-text-3 leading-tight mt-0.5">{a.titleNative}</p>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-2 hidden sm:table-cell">{a.year ?? '–'}</td>
                <td className="px-3 py-2 text-text-2 hidden md:table-cell">{a.studio ?? '–'}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5 text-xs text-text-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${a.status === 'watching' ? 'animate-pulse' : ''}`}
                      style={{ background: STATUS_CSS_VARS[a.status] ?? 'white' }}
                    />
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </td>
                <td className="px-3 py-2 pr-4 text-right font-mono text-xs text-text-2">
                  {a.myScore != null ? `${a.myScore}/10` : '–'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-3 text-sm">
                  Nincs találat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="label-mono mt-3 text-right">{rows.length} / {list.length} cím</p>

      {undoBundle && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-2xl px-5 py-3 flex items-center gap-4 text-sm">
          <span className="text-text-2">Törölve: <span className="text-text-1">{undoBundle.anime.titleRomaji}</span></span>
          <button onClick={undoDelete} className="btn-solid px-4 py-1.5 text-xs">Visszavonás</button>
        </div>
      )}
    </main>
  )
}
