'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import OnboardingCTA from '@/components/OnboardingCTA'
import RecommendMorph from '@/components/RecommendMorph'
import TonightPicker from '@/components/TonightPicker'
import TourSpotlight from '@/components/TourSpotlight'
import PageShell from '@/components/ui/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import HeroToday from '@/components/home/HeroToday'
import FollowedRow from '@/components/home/FollowedRow'
import WeekCalendar from '@/components/home/WeekCalendar'
import SeasonGrid from '@/components/home/SeasonGrid'
import NextSeason from '@/components/home/NextSeason'
import SocialFeed from '@/components/home/SocialFeed'
import { useFitScores } from '@/lib/use-fit-scores'
import { pickHero } from '@/lib/home-hero'
import { applySeasonView, seasonFacets, EMPTY_SEASON_VIEW, type SeasonView } from '@/lib/season-filter'
import type { TourStep } from '@/lib/tour'
import type {
  NewsData, MineItem, NextSeasonRow, UpcomingItem, WatchItem, FeedItem,
} from '@/components/home/types'

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null)
  // A publikus landing az SSR-ben is megjelenik, ezért kereső és első látogató
  // azonnal valódi tartalmat kap. Bejelentkezve az /api/news sikere után váltunk
  // a személyes kezdőlapra.
  const [guest, setGuest] = useState(true)
  // null = nincs hiba; '' = van hiba, de a szerver nem adott sajat uzenetet
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [digest, setDigest] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])
  const [upcomingSeason, setUpcomingSeason] = useState<{ season: string; year: number } | null>(null)
  const [nextList, setNextList] = useState<NextSeasonRow[] | null>(null)
  const [scores, setScores] = useState<Map<number, { score: number; reason: string }>>(new Map())
  const [scoresFailed, setScoresFailed] = useState(false)
  const [view, setView] = useState<SeasonView>(EMPTY_SEASON_VIEW)
  const t = useTranslations('news')
  const tc = useTranslations('common')
  const landing = useTranslations('landing')
  // A tura-lepesek forditva keletkeznek, ezert a komponensen belul allnak.
  const NEWS_TOUR: TourStep[] = [
    { selector: 'season', title: t('tourSeasonTitle'), text: t('tourSeasonText') },
    { selector: 'recommend', title: t('tourRecommendTitle'), text: t('tourRecommendText') },
    { selector: 'tonight', title: t('tourTonightTitle'), text: t('tourTonightText') },
  ]

  useEffect(() => {
    fetch('/api/news')
      .then(async (r) => {
        // Nem `tc(...)`: a forditó nem referencia-stabil, fuggosegkent minden
        // renderben ujrainditana a fetchet. Az alapertelmezes a renderben lep be.
        if (r.status === 401) { setGuest(true); return }
        if (!r.ok) throw new Error((await r.json()).error ?? '')
        setData(await r.json())
        setGuest(false)
      })
      .catch((e) => setError(String(e.message ?? e)))
    fetch('/api/digest')
      .then((r) => r.json())
      .then((j) => setDigest(j.digest ?? null))
      .catch(() => { /* digest nélkül is él az oldal */ })
    fetch('/api/feed')
      .then((r) => r.json())
      .then((j) => setFeed(j.items ?? []))
      .catch(() => { /* feed nélkül is él az oldal */ })
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((j) => setWatchlist(j.items ?? []))
      .catch(() => { /* watchlist nélkül is él az oldal */ })
    fetch('/api/browse?season=next&type=ANIME&sort=SCORE_DESC')
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((j: { media: NextSeasonRow[] }) => setNextList((j.media ?? []).slice(0, 18)))
      .catch(() => setNextList([]))
    fetch('/api/news/upcoming')
      .then((r) => r.json())
      .then((j) => { setUpcoming(j.items ?? []); setUpcomingSeason(j.season ?? null) })
      .catch(() => { /* enélkül is él az oldal */ })
    // ízlés-pontok külön csatornán: lassú AI-futás ne késleltesse a rácsot
    fetch('/api/news/season-scores')
      .then(async (r) => {
        const j = await r.json()
        const items: { anilistId: number; score: number; reason: string }[] = j.items ?? []
        if (!r.ok || !items.length) { setScoresFailed(true); return }
        setScores(new Map(items.map((i) => [i.anilistId, { score: i.score, reason: i.reason }])))
      })
      .catch(() => setScoresFailed(true))
  }, [])

  const scored = scores.size > 0
  const seasonItems = useMemo(
    () => (data?.seasonItems ?? []).map((s) => ({
      ...s,
      tasteScore: scores.get(s.anilistId)?.score ?? null,
      tasteReason: scores.get(s.anilistId)?.reason ?? null,
    })),
    [data, scores],
  )
  const facets = useMemo(() => seasonFacets(seasonItems), [seasonItems])
  // pont nélkül az ízlés-rendezés és a küszöb értelmetlen — adásidőre esünk vissza
  const effectiveView = useMemo<SeasonView>(
    () => (scored ? view : { ...view, sort: view.sort === 'taste' ? 'airing' : view.sort, minScore: 0 }),
    [scored, view],
  )
  const visibleSeason = useMemo(() => applySeasonView(seasonItems, effectiveView), [seasonItems, effectiveView])
  const seasonFit = useFitScores(visibleSeason.map((s) => s.anilistId))
  const nextFit = useFitScores((nextList ?? []).map((t) => t.anilistId))

  // a hero-ban szereplo cim ne ismetlodjon a 'Amit kovetsz' racsban
  const heroPick = useMemo(
    () => (data ? pickHero(data.mine, seasonItems, Math.floor(Date.now() / 1000), seasonFit) : null),
    [data, seasonItems, seasonFit],
  )
  const heroAnimeId =
    heroPick && (heroPick.kind === 'airing' || heroPick.kind === 'watching') ? heroPick.item.animeId : undefined

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAdded((s) => new Set(s).add(anilistId))
  }

  async function bumpProgress(m: MineItem) {
    const res = await fetch(`/api/anime/${m.animeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: m.progress + 1 }),
    })
    if (res.ok && data) {
      setData({
        ...data,
        mine: data.mine.map((x) => (x.animeId === m.animeId ? { ...x, progress: x.progress + 1 } : x)),
      })
    }
  }

  async function watchBump(w: WatchItem) {
    const res = await fetch('/api/watchlist', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id, delta: 1 }),
    })
    if (res.ok) setWatchlist((l) => l.map((x) => (x.id === w.id ? { ...x, watchedEpisodes: x.watchedEpisodes + 1 } : x)))
  }

  async function watchRemove(w: WatchItem) {
    const res = await fetch('/api/watchlist', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id }),
    })
    if (res.ok) setWatchlist((l) => l.filter((x) => x.id !== w.id))
  }

  if (guest) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#050509]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org', '@type': 'WebSite', name: 'Anime Graph',
            description: landing('seo'),
          }).replace(/</g, '\\u003c') }}
        />
        <section className="relative isolate">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_50%_55%_at_68%_26%,rgba(82,104,191,.16),transparent_72%),radial-gradient(ellipse_35%_35%_at_30%_10%,rgba(255,255,255,.05),transparent_70%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-28 md:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] md:pb-28 md:pt-36">
            <div className="relative z-10 max-w-xl">
              <p className="mb-6 inline-flex rounded-full border border-white/12 bg-white/[.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-xl">
                {landing('kicker')}
              </p>
              <h1 className="display-xl max-w-3xl text-balance text-text-1">{landing('title')}</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-2">
                {landing('body')}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/login" className="btn-solid px-5 py-3">{landing('start')}</Link>
                <Link href="/browse" className="btn-ghost border border-white/15 bg-white/[.035] px-5 py-3 backdrop-blur-xl">{landing('browse')}</Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-2xl md:mx-0">
              <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-indigo-400/10 blur-3xl" />
              <div className="relative aspect-[16/11] overflow-hidden rounded-[2rem] border border-white/14 bg-white/[.035] p-1 shadow-[0_30px_100px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.17)] backdrop-blur-2xl">
                {/* A generált PNG C2PA-metaadatait a Next optimizer nem minden környezetben olvassa;
                    közvetlenül szolgáljuk ki, hogy a hero mindig látható és teljes minőségű legyen. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/landing/liquid-glass-discovery.png"
                  alt={landing('visualAlt')}
                  loading="eager"
                  fetchPriority="high"
                  className="h-full w-full rounded-[1.8rem] object-cover"
                />
                <div aria-hidden className="absolute inset-1 rounded-[1.8rem] bg-[linear-gradient(115deg,rgba(255,255,255,.09),transparent_24%,transparent_72%,rgba(145,157,255,.1))]" />
              </div>
              <div className="absolute -bottom-5 left-4 rounded-2xl border border-white/16 bg-black/35 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-2xl md:left-8">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/50">{landing('visualKicker')}</p>
                <p className="mt-1 text-sm font-medium text-white/90">{landing('visualTitle')}</p>
              </div>
              <div className="absolute -right-2 top-8 hidden rounded-2xl border border-white/14 bg-white/[.07] px-3 py-2.5 shadow-xl shadow-black/30 backdrop-blur-2xl sm:block">
                <span className="block h-1.5 w-1.5 rounded-full bg-[#b7c6ff] shadow-[0_0_16px_4px_rgba(183,198,255,.4)]" />
                <p className="mt-2 text-[10px] font-medium tracking-wide text-white/65">{landing('visualMeta')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-y border-white/8 bg-white/[0.018]">
          <div className="mx-auto max-w-7xl px-4 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label-mono">{landing('catalogKicker')}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1">{landing('catalogTitle')}</h2>
              </div>
              <Link href="/browse" className="text-sm text-text-2 underline decoration-white/20 underline-offset-4 hover:text-text-1">{landing('catalogLink')}</Link>
            </div>
            {nextList && nextList.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {nextList.slice(0, 6).map((item) => (
                  <Link key={item.id} href={`/${item.mediaType === 'MANGA' ? 'manga' : 'anime'}/${item.slug}`} className="group min-w-0 rounded-2xl p-1 transition-colors hover:bg-white/[.055]">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,.1)]">
                      {item.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-text-1">{item.titleRomaji}</p>
                    <p className="label-mono mt-0.5">{item.format ?? item.mediaType}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-text-2">{landing('catalogFallback')}</p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [landing('feature1Title'), landing('feature1Text')],
              [landing('feature2Title'), landing('feature2Text')],
              [landing('feature3Title'), landing('feature3Text')],
            ].map(([title, text], index) => (
              <article key={title} className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.085),rgba(255,255,255,.025))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-xl">
                <p className="label-mono text-white/55">0{index + 1}</p>
                <h2 className="mt-5 text-lg font-semibold text-text-1">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{text}</p>
              </article>
            ))}
          </div>
          <div className="relative mt-12 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[1.75rem] border border-white/12 bg-[linear-gradient(110deg,rgba(255,255,255,.1),rgba(104,117,202,.1)_48%,rgba(255,255,255,.04))] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,.16)] backdrop-blur-2xl">
            <div aria-hidden className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-300/12 blur-3xl" />
            <div>
              <p className="text-lg font-semibold text-text-1">{landing('closingTitle')}</p>
              <p className="mt-1 text-sm text-text-2">{landing('closingText')}</p>
            </div>
            <Link href="/login" className="btn-solid px-5 py-3">{landing('create')}</Link>
          </div>
        </section>
      </main>
    )
  }

  if (error != null) {
    return (
      <PageShell>
        <EmptyState eyebrow={t('eyebrow')} title={t('loadFailed')} text={error || tc('error')} />
      </PageShell>
    )
  }

  return (
    <PageShell className="flex flex-col gap-14">
      {/* eszkoztar + hero egy blokkban: a gap-14 a blokkok kozott van, nem
          a gombok es a hero kozott */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-end gap-2">
          <div data-tour="tonight"><TonightPicker /></div>
          <div data-tour="recommend"><RecommendMorph onAdded={() => { /* a lista frissül a következő betöltéskor */ }} /></div>
        </div>
        <HeroToday
          mine={data?.mine ?? null}
          season={seasonItems}
          fit={seasonFit}
          digest={digest}
          onBump={bumpProgress}
          onPlan={addToPlanned}
          planned={added}
        />
      </div>

      {data && data.mine.length === 0 && <OnboardingCTA />}
      <TourSpotlight
        page="news"
        steps={NEWS_TOUR}
        force={typeof window !== 'undefined' && window.location.search.includes('tour=1')}
      />

      {data && <FollowedRow mine={data.mine} excludeAnimeId={heroAnimeId} onBump={bumpProgress} />}
      {data && <WeekCalendar mine={data.mine} />}

      {data && (
        <SeasonGrid
          season={data.season}
          items={seasonItems}
          visible={visibleSeason}
          fit={seasonFit}
          view={view}
          onView={setView}
          facets={facets}
          scored={scored}
          scoresFailed={scoresFailed}
          onPlan={addToPlanned}
          planned={added}
        />
      )}

      <NextSeason
        upcoming={upcoming}
        upcomingSeason={upcomingSeason}
        all={nextList}
        allFit={nextFit}
        onPlan={addToPlanned}
        planned={added}
      />

      <SocialFeed
        feed={feed}
        watchlist={watchlist}
        onWatchBump={watchBump}
        onWatchRemove={watchRemove}
      />
    </PageShell>
  )
}
