'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADD_OPTIONS = [
  { status: 'completed', label: 'Láttam' },
  { status: 'watching', label: 'Nézem' },
  { status: 'planned', label: 'Tervezem' },
] as const

type WatchlistMeta = { title: string; coverUrl: string | null; mediaType: string }

// preview-oldali hozzáadás: siker után átirányít a rendes anime-oldalra
export default function PreviewAddButtons({ anilistId, watchlistMeta }: { anilistId: number; watchlistMeta?: WatchlistMeta }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sharedAdded, setSharedAdded] = useState(false)

  async function add(status: string) {
    setBusy(true)
    setError('')
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId, status }),
    })
    if (res.ok) {
      const json = await res.json()
      router.push(`/anime/${json.anime.id}`)
    } else {
      setError((await res.json().catch(() => null))?.error ?? 'Hiba történt')
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ADD_OPTIONS.map((o) => (
        <button
          key={o.status}
          onClick={() => add(o.status)}
          disabled={busy}
          className="btn-ghost glass border border-white/10 rounded-full px-4 py-2 text-sm hover:border-white/30 transition-colors disabled:opacity-50"
        >
          {busy ? '…' : `+ ${o.label}`}
        </button>
      ))}
      {watchlistMeta && (
        <button
          onClick={async () => {
            const res = await fetch('/api/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ anilistId, ...watchlistMeta }),
            })
            if (res.ok) setSharedAdded(true)
          }}
          disabled={sharedAdded}
          title="Fel a közös „együtt nézzük” listára"
          className="btn-ghost glass border border-white/10 rounded-full px-4 py-2 text-sm hover:border-white/30 transition-colors disabled:text-[color:var(--status-watching)] disabled:border-transparent"
        >
          {sharedAdded ? '✓ Közösben' : '+ Közösbe'}
        </button>
      )}
      {error && <span className="text-sm text-[color:var(--status-dropped)]">{error}</span>}
    </div>
  )
}
