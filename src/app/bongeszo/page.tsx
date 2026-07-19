'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import MediaCard from '@/components/MediaCard'
import type { BrowseMedia } from '@/lib/anilist'
import type { ApiAnime } from '@/lib/types'

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller']
const ANIME_FORMATS = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL']
const MANGA_FORMATS = ['MANGA', 'NOVEL', 'ONE_SHOT']
const SORTS = [
  { value: 'POPULARITY_DESC', label: 'Népszerűség' },
  { value: 'SCORE_DESC', label: 'Pontszám' },
  { value: 'START_DATE_DESC', label: 'Újdonság' },
]
const ADD_OPTIONS = [
  { status: 'completed', label: 'Láttam' },
  { status: 'watching', label: 'Nézem' },
  { status: 'planned', label: 'Terv' },
] as const

type Filters = {
  search: string
  type: 'ANIME' | 'MANGA'
  genre: string
  year: string
  format: string
  minScore: string
  sort: string
}

const DEFAULT_FILTERS: Filters = {
  search: '', type: 'ANIME', genre: '', year: '', format: '', minScore: '', sort: 'POPULARITY_DESC',
}

function filterQuery(f: Filters, page: number): string {
  const p = new URLSearchParams()
  p.set('type', f.type)
  p.set('sort', f.sort)
  p.set('page', String(page))
  if (f.search.trim()) p.set('search', f.search.trim())
  if (f.genre) p.set('genre', f.genre)
  if (f.year) p.set('year', f.year)
  if (f.format) p.set('format', f.format)
  if (f.minScore) p.set('minScore', f.minScore)
  return p.toString()
}

export default function BrowsePage() {
  const router = useRouter()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [media, setMedia] = useState<BrowseMedia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [randomBusy, setRandomBusy] = useState(false)
  const [added, setAdded] = useState<Set<number>>(new Set())
  // saját lista: anilistId → db-id, hogy a kártya a megfelelő oldalra linkeljen
  const [ownIds, setOwnIds] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    fetch('/api/anime')
      .then((r) => (r.ok ? r.json() : { anime: [] }))
      .then((j: { anime: ApiAnime[] }) => setOwnIds(new Map(j.anime.map((a) => [a.anilistId, a.id]))))
      .catch(() => { /* linkek preview-ra esnek */ })
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const t = setTimeout(() => {
      fetch(`/api/browse?${filterQuery(filters, page)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
          const j = await r.json()
          setMedia(j.media)
          setTotal(j.total)
        })
        .catch((e) => setError(String(e.message ?? e)))
        .finally(() => setLoading(false))
    }, filters.search ? 300 : 0)
    return () => clearTimeout(t)
  }, [filters, page])

  const set = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(1)
    setFilters((f) => {
      const next = { ...f, [key]: value }
      // típusváltásnál a másik média formátumai érvénytelenek
      if (key === 'type') next.format = ''
      return next
    })
  }, [])

  function hrefFor(m: BrowseMedia): string {
    const ownId = ownIds.get(m.anilistId)
    return ownId != null ? `/anime/${ownId}` : `/anime/preview/${m.anilistId}`
  }

  async function quickAdd(anilistId: number, status: string) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId, status }),
    })
    if (res.ok) {
      const j = await res.json()
      setAdded((s) => new Set(s).add(anilistId))
      setOwnIds((m) => new Map(m).set(anilistId, j.anime.id))
    }
  }

  async function randomPick() {
    setRandomBusy(true)
    setError('')
    try {
      const r = await fetch(`/api/browse?${filterQuery(filters, 1)}&random=1`)
      if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
      const j = await r.json()
      const pick: BrowseMedia | undefined = j.media[0]
      if (pick) router.push(hrefFor(pick))
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setRandomBusy(false)
    }
  }

  const formats = filters.type === 'ANIME' ? ANIME_FORMATS : MANGA_FORMATS
  const maxPage = Math.max(1, Math.min(Math.ceil(total / 24), Math.floor(5000 / 24)))

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label-mono mb-1">Böngésző</p>
          <h1 className="text-2xl font-semibold tracking-tight">Teljes katalógus</h1>
        </div>
        <button
          onClick={randomPick}
          disabled={randomBusy}
          className="btn-ghost glass border border-white/10 rounded-full px-4 py-2 text-sm hover:border-white/30 transition-colors"
        >
          {randomBusy ? '…' : '🎲 Random'}
        </button>
      </div>

      <div className="glass rounded-3xl p-4 flex flex-wrap items-center gap-2 text-sm">
        <input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Keresés…"
          className="field rounded-full px-4 py-2 w-48"
        />
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {(['ANIME', 'MANGA'] as const).map((t) => (
            <button
              key={t}
              onClick={() => set('type', t)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors ${
                filters.type === t ? 'bg-white/10 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {t === 'ANIME' ? 'Anime' : 'Manga'}
            </button>
          ))}
        </div>
        <select value={filters.genre} onChange={(e) => set('genre', e.target.value)} className="field rounded-full px-3 py-1.5 text-xs">
          <option value="">Műfaj: mind</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <input
          value={filters.year}
          onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="Év"
          className="field rounded-full px-3 py-1.5 w-20 text-xs"
        />
        <select value={filters.format} onChange={(e) => set('format', e.target.value)} className="field rounded-full px-3 py-1.5 text-xs">
          <option value="">Formátum: mind</option>
          {formats.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filters.minScore} onChange={(e) => set('minScore', e.target.value)} className="field rounded-full px-3 py-1.5 text-xs">
          <option value="">Min. pont: —</option>
          <option value="70">70+</option>
          <option value="80">80+</option>
          <option value="85">85+</option>
        </select>
        <select value={filters.sort} onChange={(e) => set('sort', e.target.value)} className="field rounded-full px-3 py-1.5 text-xs">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {loading ? (
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
          Betöltés…
        </motion.p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {media.map((m) => {
              const owned = ownIds.has(m.anilistId) || added.has(m.anilistId)
              return (
                <MediaCard
                  key={m.anilistId}
                  title={m.title}
                  coverUrl={m.coverUrl}
                  genres={m.genres}
                  description={m.description}
                  href={hrefFor(m)}
                  badge={m.avgScore != null ? (
                    <span className="glass rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">{m.avgScore}</span>
                  ) : undefined}
                  footer={owned ? (
                    <span className="label-mono text-[color:var(--status-watching)]">✓ listán</span>
                  ) : (
                    <span className="flex gap-1">
                      {ADD_OPTIONS.map((o) => (
                        <button
                          key={o.status}
                          onClick={() => quickAdd(m.anilistId, o.status)}
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
          {media.length === 0 && <p className="text-sm text-text-2">Nincs találat.</p>}
          <div className="flex items-center justify-center gap-4 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost border border-white/10 rounded-full px-4 py-1.5 disabled:opacity-40"
            >
              ← Előző
            </button>
            <span className="font-mono text-xs text-text-2">{page} / {maxPage} · {total} találat</span>
            <button
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              disabled={page >= maxPage}
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
