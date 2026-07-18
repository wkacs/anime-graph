'use client'
import { useEffect, useState } from 'react'
import type { SearchResult } from '@/lib/anilist'
import type { ApiAnime } from '@/lib/types'

const ADD_OPTIONS = [
  { status: 'completed', label: 'Láttam' },
  { status: 'watching', label: 'Nézem' },
  { status: 'planned', label: 'Terv' },
] as const

export default function AddAnimeSearch({
  onAdded,
  ownList = [],
  onPickOwn,
}: {
  onAdded: (anime?: ApiAnime) => void
  // ha megvan: a saját lista találatai is megjelennek, kattintásra onPickOwn
  ownList?: ApiAnime[]
  onPickOwn?: (anime: ApiAnime) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  const needle = q.trim().toLowerCase()
  const ownMatches = onPickOwn && needle.length >= 2
    ? ownList.filter((a) =>
        a.titleRomaji.toLowerCase().includes(needle) ||
        (a.titleEnglish ?? '').toLowerCase().includes(needle),
      ).slice(0, 4)
    : []

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) setResults((await res.json()).results)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  async function add(anilistId: number, status: string) {
    setBusy(anilistId)
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId, status }),
    })
    setBusy(null)
    if (res.ok) {
      const json = await res.json()
      setQ('')
      setResults([])
      onAdded(json.anime)
    }
  }

  return (
    <div className="w-[min(85vw,20rem)] relative text-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Anime hozzáadása…"
        className="field glass w-full rounded-full px-4 py-2.5"
      />
      {(results.length > 0 || ownMatches.length > 0) && (
        <ul className="glass-strong absolute mt-2 w-full max-h-80 overflow-auto rounded-2xl p-1.5 z-20">
          {ownMatches.length > 0 && (
            <li className="label-mono px-2 pt-1 pb-0.5">A listádon — ugrás a gráfon</li>
          )}
          {ownMatches.map((a) => (
            <li key={`own-${a.id}`}>
              <button
                onClick={() => { setQ(''); setResults([]); onPickOwn!(a) }}
                className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/8 text-left transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.coverUrl && <img src={a.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
                <span className="flex-1 min-w-0 text-text-1">
                  <span className="block truncate">{a.titleRomaji}</span>
                  <span className="block text-xs text-text-3 font-mono">{a.year ?? '?'} · a listádon</span>
                </span>
                <span className="text-text-3">→</span>
              </button>
            </li>
          ))}
          {results.length > 0 && ownMatches.length > 0 && (
            <li className="label-mono px-2 pt-2 pb-0.5">Hozzáadás</li>
          )}
          {results.map((r) => (
            <li key={r.anilistId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/8 transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.coverUrl && <img src={r.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
              <span className="flex-1 min-w-0 text-text-1">
                <span className="block truncate">{r.titleRomaji}</span>
                <span className="block text-xs text-text-3 font-mono">{r.year ?? '?'} · {r.format ?? '?'}</span>
              </span>
              {busy === r.anilistId ? (
                <span className="text-text-2 px-2">…</span>
              ) : (
                <span className="flex gap-1 shrink-0">
                  {ADD_OPTIONS.map((o) => (
                    <button
                      key={o.status}
                      onClick={() => add(r.anilistId, o.status)}
                      disabled={busy !== null}
                      title={`Hozzáadás: ${o.label}`}
                      className="rounded-full border border-white/12 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors"
                    >
                      {o.label}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
