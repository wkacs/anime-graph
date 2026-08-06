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
import PosterAmbient from '@/components/ui/PosterAmbient'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/Reveal'
import { pickLandingCovers, type LandingCover } from '@/lib/landing'
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
  // vendég-landing vizuáljai: valódi címek a lokális katalógusból
  const [trending, setTrending] = useState<{ seasonal: LandingCover[]; popular: LandingCover[] } | null>(null)
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
    // Vendégként CSAK a publikus trending megy ki: a védett végpontok hívása
    // hat 401-et zajongana a konzolba, és mind felesleges kérés lenne.
    function loadGuest() {
      fetch('/api/trending')
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { seasonal: LandingCover[]; popular: LandingCover[] } | null) => { if (j) setTrending(j) })
        .catch(() => { /* a landing kollázs nélkül is él */ })
    }
    function loadSignedIn() {
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
    }
    // A kapu a /api/auth, nem a /api/news: az mindig 200-at ad, így vendégként
    // egyetlen 4xx sem kerül a konzolba.
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((j: { authenticated?: boolean }) => {
        if (!j.authenticated) { setGuest(true); loadGuest(); return }
        return fetch('/api/news').then(async (r) => {
          // Nem `tc(...)`: a forditó nem referencia-stabil, fuggosegkent minden
          // renderben ujrainditana a fetchet. Az alapertelmezes a renderben lep be.
          if (r.status === 401) { setGuest(true); loadGuest(); return }
          if (!r.ok) throw new Error((await r.json()).error ?? '')
          setData(await r.json())
          setGuest(false)
          loadSignedIn()
        })
      })
      .catch((e) => setError(String(e.message ?? e)))
  }, [])

  // vendég-vizuálok: az első 3 a hero-kollázs, a következő 6 a katalógus-teaser,
  // így a két blokk sosem mutatja ugyanazt a címet
  const guestCovers = useMemo(
    () => (trending ? pickLandingCovers(trending.seasonal, trending.popular, 9) : []),
    [trending],
  )

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
    const collage = guestCovers.slice(0, 3)
    const teaser = guestCovers.slice(3, 9)
    // 3 borító alatt vázlat áll: SSR-ben és lassú kapcsolaton sincs layout-ugrás
    const slots: (LandingCover | null)[] = collage.length >= 3 ? collage : [null, null, null]
    const slotClass = [
      'relative z-20 block w-44 sm:w-56 shrink-0 aspect-[2/3] overflow-hidden rounded-[var(--r-md)] hairline shadow-[0_30px_80px_rgba(0,0,0,.6)] transition-transform duration-300 hover:scale-[1.03]',
      'absolute left-0 sm:left-4 top-1/2 z-10 block w-32 sm:w-40 aspect-[2/3] -translate-y-1/2 -rotate-6 overflow-hidden rounded-[var(--r-md)] hairline shadow-2xl shadow-black/60 brightness-[.82] transition-transform duration-300 hover:scale-[1.03]',
      'absolute right-0 sm:right-4 top-1/2 z-10 block w-32 sm:w-40 aspect-[2/3] -translate-y-1/2 rotate-6 overflow-hidden rounded-[var(--r-md)] hairline shadow-2xl shadow-black/60 brightness-[.82] transition-transform duration-300 hover:scale-[1.03]',
    ]
    return (
      <main className="min-h-screen overflow-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org', '@type': 'WebSite', name: 'Anime Graph',
            description: landing('seo'),
          }).replace(/</g, '\\u003c') }}
        />
        <section className="relative isolate">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:pb-20 md:pt-36">
            <div className="relative z-10 max-w-xl">
              <p className="label-mono mb-6">{landing('kicker')}</p>
              <h1 className="display-xl max-w-3xl text-balance text-silver">{landing('title')}</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-2">
                {landing('body')}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                {/* Az elsodleges CTA a Taste Scanre megy, nem a regisztraciora:
                    igy a gomb pontosan azt csinalja, amit igér, meg fiok elott. */}
                <Link href="/scan" className="btn-solid px-5 py-3">{landing('start')}</Link>
                <Link href="/browse" className="btn-ghost surface-1 px-5 py-3">{landing('browse')}</Link>
              </div>
            </div>

            {/* hero-vizuál: 3 valódi borító a katalógusból, a fő borító blur-kópiája
                adja az ambiens fényt — nincs generált kép, a termék önmagát mutatja */}
            <div className="relative mx-auto w-full max-w-md md:mx-0 md:justify-self-end">
              {collage[0]?.coverUrl && (
                <div
                  aria-hidden
                  className="absolute -inset-14 -z-10 overflow-hidden rounded-[5rem] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)]"
                >
                  <PosterAmbient src={collage[0].coverUrl} intensity="hero" />
                </div>
              )}
              <div className="relative flex items-center justify-center py-10">
                {slots.map((c, i) =>
                  c ? (
                    <Link
                      key={c.anilistId}
                      href={`/${c.mediaType === 'MANGA' ? 'manga' : 'anime'}/${c.slug}`}
                      className={slotClass[i]}
                      title={c.titleRomaji}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.coverUrl!} alt={c.titleRomaji} loading="eager" className="h-full w-full object-cover" />
                    </Link>
                  ) : (
                    <div key={i} aria-hidden className={`${slotClass[i]} bg-white/5`} />
                  ),
                )}
              </div>
              <div className="surface-2 absolute -bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-2xl px-4 py-3 sm:left-6 sm:translate-x-0">
                <p className="label-mono">{landing('visualKicker')}</p>
                <p className="mt-1 whitespace-nowrap text-sm font-medium text-text-1">{landing('visualTitle')}</p>
              </div>
              <div className="surface-2 absolute -right-1 top-4 z-30 hidden rounded-xl px-3 py-2 sm:block">
                <p className="label-mono">{landing('visualMeta')}</p>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-16">
            <RevealGroup className="grid grid-cols-3 gap-4 border-t border-white/8 pt-8">
              {[
                [landing('stat1Value'), landing('stat1Label')],
                [landing('stat2Value'), landing('stat2Label')],
                [landing('stat3Value'), landing('stat3Label')],
              ].map(([value, label]) => (
                <RevealItem key={label} className="min-w-0">
                  <p className="display-l text-text-1">{value}</p>
                  <p className="label-mono mt-1">{label}</p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        <section className="relative border-y border-white/8 bg-white/[0.018]">
          <div className="mx-auto max-w-7xl px-4 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label-mono">{landing('catalogKicker')}</p>
                <h2 className="h2 mt-2 text-text-1">{landing('catalogTitle')}</h2>
              </div>
              <Link href="/browse" className="text-sm text-text-2 underline decoration-white/20 underline-offset-4 hover:text-text-1">{landing('catalogLink')}</Link>
            </div>
            {teaser.length > 0 ? (
              <RevealGroup className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {teaser.map((item) => (
                  <RevealItem key={item.anilistId} className="min-w-0">
                    <Link href={`/${item.mediaType === 'MANGA' ? 'manga' : 'anime'}/${item.slug}`} className="group block min-w-0 rounded-2xl p-1 transition-colors hover:bg-white/[.055]">
                      <div className="glass-lite relative aspect-[2/3] overflow-hidden rounded-[var(--r-sm)]">
                        {item.coverUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-text-1">{item.titleRomaji}</p>
                      <p className="label-mono mt-0.5">
                        {item.format ?? item.mediaType}
                        {item.year ? ` · ${item.year}` : ''}
                      </p>
                    </Link>
                  </RevealItem>
                ))}
              </RevealGroup>
            ) : (
              <p className="mt-6 text-sm text-text-2">{landing('catalogFallback')}</p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20">
          <RevealGroup className="grid gap-4 md:grid-cols-3" delay={0.1}>
            {[
              [landing('feature1Title'), landing('feature1Text')],
              [landing('feature2Title'), landing('feature2Text')],
              [landing('feature3Title'), landing('feature3Text')],
            ].map(([title, text], index) => (
              <RevealItem key={title}>
                <article className="glass-2 h-full rounded-[var(--r-lg)] p-6">
                  <p className="label-mono">0{index + 1}</p>
                  <h2 className="h2 mt-4 text-text-1">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-text-2">{text}</p>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
          <div className="surface-2 relative mt-12 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[var(--r-xl)] p-7">
            {teaser[0]?.coverUrl && <PosterAmbient src={teaser[0].coverUrl} intensity="card" />}
            <div className="relative">
              <p className="h2 text-text-1">{landing('closingTitle')}</p>
              <p className="mt-1 text-sm text-text-2">{landing('closingText')}</p>
            </div>
            <Link href="/login" className="btn-solid relative px-5 py-3">{landing('create')}</Link>
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
      {data && <Reveal><WeekCalendar mine={data.mine} /></Reveal>}

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

      <Reveal>
        <NextSeason
          upcoming={upcoming}
          upcomingSeason={upcomingSeason}
          all={nextList}
          allFit={nextFit}
          onPlan={addToPlanned}
          planned={added}
        />
      </Reveal>

      <Reveal>
        <SocialFeed
          feed={feed}
          watchlist={watchlist}
          onWatchBump={watchBump}
          onWatchRemove={watchRemove}
        />
      </Reveal>
    </PageShell>
  )
}
