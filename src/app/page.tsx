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
      <main className="min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org', '@type': 'WebSite', name: 'Anime Graph',
            description: landing('seo'),
          }).replace(/</g, '\\u003c') }}
        />
        <section className="mx-auto flex max-w-6xl flex-col px-4 pb-16 pt-28 md:pt-36">
          <p className="label-mono mb-4">{landing('kicker')}</p>
          <h1 className="display-xl max-w-4xl text-text-1">{landing('title')}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-2">
            {landing('body')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-solid px-5 py-3">{landing('start')}</Link>
            <Link href="/browse" className="btn-ghost border border-white/15 px-5 py-3">{landing('browse')}</Link>
          </div>
        </section>

        <section className="border-y border-white/8 bg-white/[0.015]">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label-mono">{landing('catalogKicker')}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-1">{landing('catalogTitle')}</h2>
              </div>
              <Link href="/browse" className="text-sm text-text-2 underline decoration-white/20 underline-offset-4 hover:text-text-1">{landing('catalogLink')}</Link>
            </div>
            {nextList && nextList.length > 0 ? (
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {nextList.slice(0, 6).map((item) => (
                  <Link key={item.id} href={`/${item.mediaType === 'MANGA' ? 'manga' : 'anime'}/${item.slug}`} className="group min-w-0">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--r-md)] bg-white/5">
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

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [landing('feature1Title'), landing('feature1Text')],
              [landing('feature2Title'), landing('feature2Text')],
              [landing('feature3Title'), landing('feature3Text')],
            ].map(([title, text], index) => (
              <article key={title} className="surface-2 rounded-[var(--r-lg)] p-6">
                <p className="label-mono">0{index + 1}</p>
                <h2 className="mt-5 text-lg font-semibold text-text-1">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-lg)] border border-white/10 p-6">
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
