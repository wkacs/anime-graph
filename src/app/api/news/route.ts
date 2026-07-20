import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { fetchAiringFor, fetchSeason } from '@/lib/anilist'
import { currentSeason } from '@/lib/seasonal'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Az ízlés-pontok külön csatornán jönnek (/api/news/season-scores), hogy egy lassú
// vagy hiányzó AI-futás ne késleltesse a rács megjelenését.
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.mediaType, 'ANIME')))
  const season = currentSeason(new Date())

  const followedIds = rows
    .filter((r) => r.status === 'watching' || r.status === 'planned')
    .map((r) => r.anilistId)

  const [airing, seasonList] = await Promise.all([
    followedIds.length ? fetchAiringFor(followedIds).catch(() => []) : Promise.resolve([]),
    fetchSeason(season.season, season.year).catch(() => []),
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
        genres: row.genres,
        description: row.description,
        status: row.status,
        progress: row.progress,
        episodes: row.episodes,
        airingAt: a.airingAt,
        nextEpisode: a.nextEpisode,
      }
    })
    .sort((x, y) => x.airingAt - y.airingAt)

  const ownedIds = new Set(rows.map((r) => r.anilistId))
  // a sorrendet a kliens állítja (season-filter), itt az AniList népszerűség-sorrend marad
  const seasonItems = seasonList.map((s) => ({ ...s, owned: ownedIds.has(s.anilistId) }))

  return NextResponse.json({ season, mine, seasonItems })
}
