'use client'
import { useEffect, useState } from 'react'
import type { SearchResult } from '@/lib/anilist'

export default function AddAnimeSearch({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) setResults((await res.json()).results)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  async function add(anilistId: number) {
    setBusy(anilistId)
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    setBusy(null)
    if (res.ok) { setQ(''); setResults([]); onAdded() }
  }

  return (
    <div className="w-72 relative text-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Anime hozzáadása…"
        className="w-full rounded-xl bg-slate-900/85 border border-slate-700 px-3 py-2 text-slate-200 outline-none focus:border-cyan-400 backdrop-blur"
      />
      {results.length > 0 && (
        <ul className="absolute mt-1 w-full max-h-80 overflow-auto rounded-xl bg-slate-900 border border-slate-700 z-20">
          {results.map((r) => (
            <li key={r.anilistId}>
              <button
                onClick={() => add(r.anilistId)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-slate-800 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.coverUrl && <img src={r.coverUrl} alt="" className="w-8 h-11 object-cover rounded" />}
                <span className="flex-1 text-slate-200">
                  {r.titleRomaji}
                  <span className="block text-xs text-slate-400">{r.year ?? '?'} · {r.format ?? '?'}</span>
                </span>
                {busy === r.anilistId && <span className="text-cyan-400">…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
