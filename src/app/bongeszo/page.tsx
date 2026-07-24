'use client'
import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import MediaCard from '@/components/MediaCard'
import { useFitScores, fitColor } from '@/lib/use-fit-scores'
import TourSpotlight from '@/components/TourSpotlight'
import type { TourStep } from '@/lib/tour'

const BONGESZO_TOUR: TourStep[] = [
  { selector: 'search', title: 'Katalógus', text: ' 130 ezer anime és manga, saját adatbázisból — villámgyors keresés, szűrők, egy-kattintásos hozzáadás.' },
  { selector: 'results', title: 'Neked való?', text: 'A találatokon a %-badge azt mutatja, mennyire illik az ízlésedhez — a saját listádból számolva, minden címre.' },
]
import type { TitleHit } from '@/lib/search'
import type { ApiAnime } from '@/lib/types'
import { SEASON_LABELS } from '@/lib/seasonal'

// a /api/trending title-sorai TitleHit-alakra képezve, hogy a kártya-rács közös legyen
type TrendingRow = {
  id: number; anilistId: number; mediaType: string; slug: string
  titleRomaji: string; titleEnglish: string | null; coverUrl: string | null
  year: number | null; format: string | null; communityScore: number | null; popularity: number
}
type TrendingData = { seasonal: TrendingRow[]; popular: TrendingRow[]; season: { season: string; year: number } }

const toHit = (t: TrendingRow): TitleHit => ({
  titleId: t.id, anilistId: t.anilistId, mediaType: t.mediaType, slug: t.slug,
  titleRomaji: t.titleRomaji, titleEnglish: t.titleEnglish, coverUrl: t.coverUrl,
  year: t.year, format: t.format, communityScore: t.communityScore, popularity: t.popularity,
})

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
  const [trending, setTrending] = useState<TrendingData | null>(null)
  // linkelhető szűrők (?studio=…, ?season=current|next) — pl. a címoldali stúdió-chipről
  const [studioFilter, setStudioFilter] = useState<string | null>(null)
  const [seasonKey, setSeasonKey] = useState<'current' | 'next' | null>(null)
  const [filtered, setFiltered] = useState<TitleHit[] | null>(null)
  const trendingHits = trending
    ? { seasonal: trending.seasonal.map(toHit), popular: trending.popular.map(toHit) }
    : null
  const fitScores = useFitScores(
    search.trim()
      ? hits.map((h) => h.anilistId)
      : filtered
        ? filtered.map((h) => h.anilistId)
        : trendingHits
          ? [...trendingHits.seasonal, ...trendingHits.popular].map((h) => h.anilistId)
          : [],
  )
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

  // üres állapot: felkapott címek a lokális katalógusból
  useEffect(() => {
    fetch('/api/trending')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: TrendingData | null) => { if (j) setTrending(j) })
      .catch(() => { /* üres állapot marad a szöveges hint */ })
  }, [])

  // induló szűrők a querystringből (?studio=…, ?season=current|next)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const st = sp.get('studio')
    if (st) setStudioFilter(st)
    const se = sp.get('season')
    if (se === 'current' || se === 'next') setSeasonKey(se)
  }, [])

  // szűrt nézet a lokális browse-ból, keresés nélkül
  useEffect(() => {
    if (!studioFilter && !seasonKey) { setFiltered(null); return }
    const qs = new URLSearchParams({ type, sort: 'SCORE_DESC' })
    if (studioFilter) qs.set('studio', studioFilter)
    if (seasonKey) qs.set('season', seasonKey)
    fetch(`/api/browse?${qs}`)
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((j: { media: TrendingRow[] }) => setFiltered((j.media ?? []).map(toHit)))
      .catch(() => setFiltered([]))
  }, [studioFilter, seasonKey, type])

  // a szűrő-állapot visszaírása az URL-be, hogy linkelhető maradjon
  function syncFilterUrl(studio: string | null, season: 'current' | 'next' | null) {
    const sp = new URLSearchParams()
    if (studio) sp.set('studio', studio)
    if (season) sp.set('season', season)
    const qs = sp.toString()
    window.history.replaceState(null, '', qs ? `/bongeszo?${qs}` : '/bongeszo')
  }

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

  function cardFor(h: TitleHit) {
    const owned = ownIds.has(h.anilistId) || added.has(h.titleId)
    const fit = fitScores[h.anilistId]
    return (
      <MediaCard
        key={h.titleId}
        title={h.titleRomaji}
        coverUrl={h.coverUrl}
        genres={[]}
        href={hrefFor(h)}
        badge={fit != null ? (
          <span className="glass rounded-full px-2 py-0.5 font-mono text-[11px]" style={{ color: fitColor(fit) }} title="Ennyire illik az ízlésedhez">{fit}%</span>
        ) : h.communityScore != null ? (
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

      <TourSpotlight page="bongeszo" steps={BONGESZO_TOUR} />

      <div data-tour="search" className="glass rounded-3xl p-4 flex flex-wrap items-center gap-2 text-sm">
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
        {([['current', 'Aktuális szezon'], ['next', 'Következő szezon']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              const next = seasonKey === k ? null : k
              setSeasonKey(next)
              syncFilterUrl(studioFilter, next)
            }}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              seasonKey === k ? 'border-white/40 text-text-1' : 'border-white/10 text-text-2 hover:text-text-1'
            }`}
          >
            {label}
          </button>
        ))}
        {studioFilter && (
          <button
            onClick={() => { setStudioFilter(null); syncFilterUrl(null, seasonKey) }}
            className="rounded-full border border-white/40 px-3 py-1.5 text-xs text-text-1"
            title="Stúdió-szűrő törlése"
          >
            Stúdió: {studioFilter} ✕
          </button>
        )}
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {!search.trim() ? (
        (studioFilter || seasonKey) ? (
          <section className="flex flex-col gap-3">
            <p className="label-mono">
              {[
                studioFilter ? `Stúdió: ${studioFilter}` : null,
                seasonKey === 'current' ? 'Aktuális szezon' : seasonKey === 'next' ? 'Következő szezon' : null,
              ].filter(Boolean).join(' · ')}
            </p>
            {filtered == null ? (
              <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
                Betöltés…
              </motion.p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-text-2">
                {seasonKey === 'next'
                  ? 'Még kevés bejelentett cím — a katalógus-sync bővíti majd.'
                  : 'Nincs találat ezzel a szűrővel.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map(cardFor)}
              </div>
            )}
          </section>
        ) : trendingHits && (trendingHits.seasonal.length > 0 || trendingHits.popular.length > 0) ? (
          <>
            {trendingHits.seasonal.length > 0 && (
              <section className="flex flex-col gap-3">
                <p className="label-mono">
                  Felkapott most — {trending ? `${SEASON_LABELS[trending.season.season] ?? trending.season.season} ${trending.season.year}` : ''}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {trendingHits.seasonal.map(cardFor)}
                </div>
              </section>
            )}
            {trendingHits.popular.length > 0 && (
              <section className="flex flex-col gap-3">
                <p className="label-mono">Nálunk népszerű</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {trendingHits.popular.map(cardFor)}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="text-sm text-text-2">Írj be egy címet a kereséshez.</p>
        )
      ) : loading ? (
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
          Betöltés…
        </motion.p>
      ) : (
        <>
          <div data-tour="results" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {hits.map(cardFor)}
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
