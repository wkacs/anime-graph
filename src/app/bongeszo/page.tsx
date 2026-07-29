'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import MediaCard from '@/components/MediaCard'
import { useFitScores } from '@/lib/use-fit-scores'
import { SEASON_LABELS } from '@/lib/seasonal'
import { useAuthStatus } from '@/lib/use-auth-status'
import ScoreBadge from '@/components/ui/ScoreBadge'
import PageShell from '@/components/ui/PageShell'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import TourSpotlight from '@/components/TourSpotlight'
import type { TourStep } from '@/lib/tour'

import type { TitleHit } from '@/lib/search'
import type { ApiAnime } from '@/lib/types'

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

const ADD_OPTIONS = ['completed', 'watching', 'planned'] as const

const PAGE_SIZE = 24

export default function BrowsePage() {
  const router = useRouter()
  const authenticated = useAuthStatus()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'ANIME' | 'MANGA'>('ANIME')
  const [page, setPage] = useState(0) // 0-based offset page
  const [hits, setHits] = useState<TitleHit[]>([])
  const [trending, setTrending] = useState<TrendingData | null>(null)
  // linkelhető szűrők (?studio=…, ?season=current|next) — pl. a címoldali stúdió-chipről
  const [studioFilter, setStudioFilter] = useState<string | null>(null)
  const [seasonKey, setSeasonKey] = useState<'current' | 'next' | null>(null)
  const [filtered, setFiltered] = useState<TitleHit[] | null>(null)
  // `tr`, nem `t`: a fajlban tobb helyi `t` van (setTimeout-id, media-tipus param).
  const tr = useTranslations('browse')
  const ta = useTranslations('addSearch')
  // A tura-lepesek forditva keletkeznek, ezert a komponensen belul allnak.
  const BONGESZO_TOUR: TourStep[] = [
    { selector: 'search', title: tr('tourCatalogTitle'), text: tr('tourCatalogText') },
    { selector: 'results', title: tr('tourFitTitle'), text: tr('tourFitText') },
  ]
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
  const searchRef = useRef<HTMLInputElement>(null)

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

  // induló szűrők a querystringből (?studio=…, ?season=current|next, ?focus=1)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const st = sp.get('studio')
    if (st) setStudioFilter(st)
    const se = sp.get('season')
    if (se === 'current' || se === 'next') setSeasonKey(se)
    // a nav kereső-ikonja ide navigál: fókuszáljuk a meglévő inputot
    if (sp.get('focus') === '1') {
      searchRef.current?.focus()
      window.history.replaceState(null, '', '/browse')
    }
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
    window.history.replaceState(null, '', qs ? `/browse?${qs}` : '/browse')
  }

  useEffect(() => {
    const q = search.trim()
    if (!q) { setHits([]); setError(''); setLoading(false); return }
    setLoading(true)
    setError('')
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
        .then(async (r) => {
          // Ures uzenet: a forditott alapertelmezes a renderben lep be, hogy a
          // forditó ne valjon useEffect-fuggosegge.
          if (!r.ok) throw new Error('')
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
          <ScoreBadge score={fit} suffix="%" title="Ennyire illik az ízlésedhez" />
        ) : h.communityScore != null ? (
          <span className="surface-2 rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">
            {h.communityScore.toFixed(1)}
          </span>
        ) : undefined}
        footer={owned ? (
          <span className="label-mono text-[color:var(--status-watching)]">✓ listán</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {ADD_OPTIONS.map((o) => (
              <Button
                key={o}
                onClick={() => quickAdd(h, o)}
                title={ta('addAs', { label: ta(`add_${o}`) })}
                className="font-mono text-[10px] uppercase tracking-wide"
              >
                {ta(`add_${o}`)}
              </Button>
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
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/browse?focus=1`)}`)
      return
    }
    if (res.ok) {
      const j = await res.json()
      setAdded((s) => new Set(s).add(h.titleId))
      setOwnIds((m) => new Map(m).set(h.anilistId, j.anime.id))
    }
  }

  return (
    <PageShell className="flex flex-col gap-10">
      <div>
        <p className="label-mono mb-2">Böngésző</p>
        <h1 className="display-l text-text-1">Katalógus-keresés</h1>
      </div>

      {authenticated === true && <TourSpotlight page="bongeszo" steps={BONGESZO_TOUR} />}

      <div
        data-tour="search"
        className="surface-3 sticky top-20 z-30 rounded-[var(--r-lg)] p-4 flex flex-wrap items-center gap-2 text-sm"
      >
        <input
          ref={searchRef}
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
          <Chip
            variant="link"
            title="Stúdió-szűrő törlése"
            onDismiss={() => { setStudioFilter(null); syncFilterUrl(null, seasonKey) }}
          >
            Stúdió: {studioFilter}
          </Chip>
        )}
        {(studioFilter || seasonKey) && (
          <Chip
            variant="link"
            title="Minden szűrő törlése"
            onDismiss={() => { setStudioFilter(null); setSeasonKey(null); syncFilterUrl(null, null) }}
          >
            Töröl mind
          </Chip>
        )}
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {!search.trim() ? (
        (studioFilter || seasonKey) ? (
          <section>
            <SectionHeader
              eyebrow="Szűrve"
              title={[
                studioFilter ? `Stúdió: ${studioFilter}` : null,
                seasonKey === 'current' ? 'Aktuális szezon' : seasonKey === 'next' ? 'Következő szezon' : null,
              ].filter(Boolean).join(' · ')}
            />
            {filtered == null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                <Skeleton variant="poster" count={12} />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                eyebrow="Szűrő"
                title={seasonKey === 'next' ? 'Még kevés bejelentett cím' : 'Nincs találat'}
                text={seasonKey === 'next'
                  ? 'A következő szezon kínálatát a katalógus-sync fokozatosan bővíti.'
                  : 'Próbáld más stúdióval vagy szezonnal.'}
                action={
                  <Button onClick={() => { setStudioFilter(null); setSeasonKey(null); syncFilterUrl(null, null) }}>
                    Szűrők törlése
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                {filtered.map(cardFor)}
              </div>
            )}
          </section>
        ) : trendingHits && (trendingHits.seasonal.length > 0 || trendingHits.popular.length > 0) ? (
          <>
            {trendingHits.seasonal.length > 0 && (
              <section>
                <SectionHeader
                  eyebrow="Felkapott most"
                  title={trending ? `${SEASON_LABELS[trending.season.season] ?? trending.season.season} ${trending.season.year}` : 'Ebben a szezonban'}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                  {trendingHits.seasonal.map(cardFor)}
                </div>
              </section>
            )}
            {trendingHits.popular.length > 0 && (
              <section>
                <SectionHeader eyebrow="Katalógus" title="Nálunk népszerű" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                  {trendingHits.popular.map(cardFor)}
                </div>
              </section>
            )}
          </>
        ) : trending == null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
            <Skeleton variant="poster" count={12} />
          </div>
        ) : (
          <EmptyState
            eyebrow="Katalógus"
            title="Mit keresel?"
            text="130 ezer anime és manga a saját adatbázisunkból. Írj be egy címet, vagy szűrj szezonra."
          />
        )
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
          <Skeleton variant="poster" count={12} />
        </div>
      ) : (
        <>
          <div data-tour="results" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
            {hits.map(cardFor)}
          </div>
          {hits.length === 0 && (
            <EmptyState
              eyebrow="Keresés"
              title="Nincs találat"
              text={`A „${search.trim()}” kifejezésre nincs cím a katalógusban. Próbáld a romaji címmel, vagy váltsd át ${type === 'ANIME' ? 'mangára' : 'animére'}.`}
              action={
                <Button onClick={() => setKind(type === 'ANIME' ? 'MANGA' : 'ANIME')}>
                  Váltás {type === 'ANIME' ? 'mangára' : 'animére'}
                </Button>
              }
            />
          )}
          {hits.length > 0 && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <Button size="md" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
                ← Előző
              </Button>
              <span className="font-mono text-xs text-text-2 tabular-nums">
                {page + 1}. oldal · {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + hits.length}
              </span>
              <Button size="md" onClick={() => setPage((p) => p + 1)} disabled={hits.length < PAGE_SIZE}>
                Következő →
              </Button>
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}
