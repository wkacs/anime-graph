import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { fetchAiringFor, fetchSeason } from '@/lib/anilist'
import { currentSeason } from '@/lib/seasonal'
import { getCached, setCached } from '@/lib/api-cache'
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

  // seasonal: napi cache; airing: óránkénti cache — nem minden oldalbetöltésnél AniList-hívás
  const seasonKey = `season:${season.season}:${season.year}`
  let seasonList = await getCached<Awaited<ReturnType<typeof fetchSeason>>>(seasonKey)
  if (!seasonList) {
    seasonList = await fetchSeason(season.season, season.year).catch(() => [])
    if (seasonList.length) await setCached(seasonKey, seasonList, 86400)
  }

  let airing: Awaited<ReturnType<typeof fetchAiringFor>> = []
  if (followedIds.length) {
    const airingKey = `airing:${[...followedIds].sort((a, b) => a - b).join(',')}`
    airing = await getCached<Awaited<ReturnType<typeof fetchAiringFor>>>(airingKey) ?? []
    if (!airing.length) {
      airing = await fetchAiringFor(followedIds).catch(() => [])
      if (airing.length) await setCached(airingKey, airing, 3600)
    }
  }

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
