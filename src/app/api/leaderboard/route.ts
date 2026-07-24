import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { leaderboardQuery, parseLeaderboardTab, LEADERBOARD_LIMIT } from '@/lib/leaderboard'

// PUBLIKUS route (middleware-whitelisten) — csak katalogus-adatot ad ki, user-adatot nem.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const tab = parseLeaderboardTab(sp.get('tab'))
  const mediaType = sp.get('type') === 'MANGA' ? 'MANGA' as const : 'ANIME' as const
  const genre = sp.get('genre') || undefined
  try {
    const { where, order } = leaderboardQuery(tab, mediaType, genre)
    const rows = await db.select({
      id: title.id,
      slug: title.slug,
      mediaType: title.mediaType,
      titleRomaji: title.titleRomaji,
      coverUrl: title.coverUrl,
      genres: title.genres,
      avgScore: title.avgScore,
      communityScore: title.communityScore,
      communityCount: title.communityCount,
      popularity: title.popularity,
    }).from(title).where(where).orderBy(order).limit(LEADERBOARD_LIMIT)
    return NextResponse.json(
      { items: rows.map((r, i) => ({ rank: i + 1, ...r })) },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' } },
    )
  } catch (e) {
    console.error('leaderboard failed:', e)
    return NextResponse.json({ error: 'A toplista most nem elérhető' }, { status: 502 })
  }
}
