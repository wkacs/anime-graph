'use client'
import { useEffect, useMemo, useState } from 'react'
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

const NEWS_TOUR: TourStep[] = [
  { selector: 'season', title: 'Szezon', text: 'Az aktuális szezon minden címe — a badge azt mutatja, mennyire illik az ízlésedhez. Lista nélkül is él.' },
  { selector: 'recommend', title: 'Ajánlj nekem', text: 'Egy gomb: az AI a listádból és a véleményeidből tanult ízlésed alapján ajánl. Ez a lényeg.' },
  { selector: 'tonight', title: 'Ma este?', text: 'Nincs kedved dönteni? Hangulat + idő alapján kiválasztja, mit nézz ma este.' },
]

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [digest, setDigest] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [wlUsers, setWlUsers] = useState<Record<number, string>>({})
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])
  const [upcomingSeason, setUpcomingSeason] = useState<{ season: string; year: number } | null>(null)
  const [nextList, setNextList] = useState<NextSeasonRow[] | null>(null)
  const [scores, setScores] = useState<Map<number, { score: number; reason: string }>>(new Map())
  const [scoresFailed, setScoresFailed] = useState(false)
  const [view, setView] = useState<SeasonView>(EMPTY_SEASON_VIEW)

  useEffect(() => {
    fetch('/api/news')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
        setData(await r.json())
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
      .then((j) => { setWatchlist(j.items ?? []); setWlUsers(j.usernames ?? {}) })
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

  if (error) {
    return (
      <PageShell>
        <EmptyState eyebrow="Hírek" title="Nem sikerült betölteni" text={error} />
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
        usernames={wlUsers}
        onWatchBump={watchBump}
        onWatchRemove={watchRemove}
      />
    </PageShell>
  )
}
