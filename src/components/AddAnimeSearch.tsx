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
        className="field glass w-full rounded-full px-4 py-2.5"
      />
      {results.length > 0 && (
        <ul className="glass-strong absolute mt-2 w-full max-h-80 overflow-auto rounded-2xl p-1.5 z-20">
          {results.map((r) => (
            <li key={r.anilistId}>
              <button
                onClick={() => add(r.anilistId)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/8 text-left transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.coverUrl && <img src={r.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
                <span className="flex-1 text-text-1">
                  {r.titleRomaji}
                  <span className="block text-xs text-text-3 font-mono">{r.year ?? '?'} · {r.format ?? '?'}</span>
                </span>
                {busy === r.anilistId && <span className="text-text-2">…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
