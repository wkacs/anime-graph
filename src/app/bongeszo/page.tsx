'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import MediaCard from '@/components/MediaCard'
import type { TitleHit } from '@/lib/search'
import type { ApiAnime } from '@/lib/types'

const ADD_OPTIONS = [
  { status: 'completed', label: 'Láttam' },
  { status: 'watching', label: 'Nézem' },
  { status: 'planned', label: 'Terv' },
] as const

const PAGE_SIZE = 24

export default function BrowsePage() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'ANIME' | 'MANGA'>('ANIME')
  const [page, setPage] = useState(0) // 0-based offset page
  const [hits, setHits] = useState<TitleHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set()) // titleId set
  // saját lista: anilistId → db-id, hogy a kártya a megfelelő oldalra linkeljen
  const [ownIds, setOwnIds] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    fetch('/api/anime')
      .then((r) => (r.ok ? r.json() : { anime: [] }))
      .then((j: { anime: ApiAnime[] }) => setOwnIds(new Map(j.anime.map((a) => [a.anilistId, a.id]))))
      .catch(() => { /* linkek preview-ra esnek */ })
  }, [])

  useEffect(() => {
    const q = search.trim()
    if (!q) { setHits([]); setError(''); setLoading(false); return }
    setLoading(true)
    setError('')
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
        .then(async (r) => {
          if (!r.ok) throw new Error('Hiba történt')
          const j = await r.json() as { hits: TitleHit[] }
          setHits(j.hits)
        })
        .catch((e) => setError(String(e.message ?? e)))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search, type, page])

  const setQuery = useCallback((v: string) => { setPage(0); setSearch(v) }, [])
  const setKind = useCallback((t: 'ANIME' | 'MANGA') => { setPage(0); setType(t) }, [])

  // canonical page serves both owned and not-owned (owner controls via overlay)
  function hrefFor(h: TitleHit): string {
    return `/${h.mediaType === 'MANGA' ? 'manga' : 'anime'}/${h.slug}`
  }

  async function quickAdd(h: TitleHit, status: string) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: h.anilistId, status }),
    })
    if (res.ok) {
      const j = await res.json()
      setAdded((s) => new Set(s).add(h.titleId))
      setOwnIds((m) => new Map(m).set(h.anilistId, j.anime.id))
    }
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label-mono mb-1">Böngésző</p>
          <h1 className="text-2xl font-semibold tracking-tight">Katalógus-keresés</h1>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 flex flex-wrap items-center gap-2 text-sm">
        <input
          value={search}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés a katalógusban…"
          className="field rounded-full px-4 py-2 w-64"
        />
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {(['ANIME', 'MANGA'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setKind(t)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors ${
                type === t ? 'bg-white/10 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {t === 'ANIME' ? 'Anime' : 'Manga'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {!search.trim() ? (
        <p className="text-sm text-text-2">Írj be egy címet a kereséshez.</p>
      ) : loading ? (
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
          Betöltés…
        </motion.p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {hits.map((h) => {
              const owned = ownIds.has(h.anilistId) || added.has(h.titleId)
              return (
                <MediaCard
                  key={h.titleId}
                  title={h.titleRomaji}
                  coverUrl={h.coverUrl}
                  genres={[]}
                  href={hrefFor(h)}
                  badge={h.communityScore != null ? (
                    <span className="glass rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">{h.communityScore.toFixed(1)}</span>
                  ) : undefined}
                  footer={owned ? (
                    <span className="label-mono text-[color:var(--status-watching)]">✓ listán</span>
                  ) : (
                    <span className="flex gap-1">
                      {ADD_OPTIONS.map((o) => (
                        <button
                          key={o.status}
                          onClick={() => quickAdd(h, o.status)}
                          title={`Hozzáadás: ${o.label}`}
                          className="rounded-full border border-white/12 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors"
                        >
                          {o.label}
                        </button>
                      ))}
                    </span>
                  )}
                />
              )
            })}
          </div>
          {hits.length === 0 && <p className="text-sm text-text-2">Nincs találat a katalógusban.</p>}
          <div className="flex items-center justify-center gap-4 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0}
              className="btn-ghost border border-white/10 rounded-full px-4 py-1.5 disabled:opacity-40"
            >
              ← Előző
            </button>
            <span className="font-mono text-xs text-text-2">{page + 1}. oldal</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={hits.length < PAGE_SIZE}
              className="btn-ghost border border-white/10 rounded-full px-4 py-1.5 disabled:opacity-40"
            >
              Következő →
            </button>
          </div>
        </>
      )}
    </main>
  )
}
