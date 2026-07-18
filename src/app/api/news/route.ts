import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations } from '@/db/schema'
import { fetchAiringFor, fetchSeason } from '@/lib/anilist'
import { currentSeason } from '@/lib/seasonal'
import { requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

type SeasonScore = { anilistId: number; score: number; reason: string }

// cached taste scores from the szezon page, if a run exists for this season
async function cachedSeasonScores(userId: number, input: { season: string; year: number }): Promise<Map<number, SeasonScore>> {
  const rows = await db.select().from(recommendations)
    .where(and(eq(recommendations.kind, 'seasonal'), eq(recommendations.userId, userId)))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  const latest = rows[0]
  if (!latest) return new Map()
  const li = latest.input as { season: string; year: number }
  if (li.season !== input.season || li.year !== input.year) return new Map()
  const items = (latest.result as { items?: SeasonScore[] }).items ?? []
  return new Map(items.map((i) => [i.anilistId, i]))
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  const season = currentSeason(new Date())

  const followedIds = rows
    .filter((r) => r.status === 'watching' || r.status === 'planned')
    .map((r) => r.anilistId)

  const [airing, seasonList, scores] = await Promise.all([
    followedIds.length ? fetchAiringFor(followedIds).catch(() => []) : Promise.resolve([]),
    fetchSeason(season.season, season.year).catch(() => []),
    cachedSeasonScores(userId, season),
  ])

  const byAnilist = new Map(rows.map((r) => [r.anilistId, r]))
  const mine = airing
    .map((a) => {
      const row = byAnilist.get(a.anilistId)!
      return {
        animeId: row.id,
        anilistId: row.anilistId,
        title: row.titleRomaji,
        coverUrl: row.coverUrl,
        status: row.status,
        progress: row.progress,
        episodes: row.episodes,
        airingAt: a.airingAt,
        nextEpisode: a.nextEpisode,
      }
    })
    .sort((x, y) => x.airingAt - y.airingAt)

  const ownedIds = new Set(rows.map((r) => r.anilistId))
  const seasonItems = seasonList
    .map((s) => ({
      ...s,
      owned: ownedIds.has(s.anilistId),
      tasteScore: scores.get(s.anilistId)?.score ?? null,
      tasteReason: scores.get(s.anilistId)?.reason ?? null,
    }))
    .sort((a, b) => (a.airingAt ?? Infinity) - (b.airingAt ?? Infinity))

  return NextResponse.json({ season, mine, seasonItems })
}
