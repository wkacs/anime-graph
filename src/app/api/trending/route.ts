import { NextResponse } from 'next/server'
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { trendingSeasonParams, TRENDING_LIMIT } from '@/lib/trending'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// A böngésző üres állapotát tölti: tisztán lokális katalógus-query, külső hívás nélkül.
export async function GET() {
  const s = trendingSeasonParams(new Date())
  try {
    const [seasonal, popular] = await Promise.all([
      db.select().from(title)
        .where(and(eq(title.mediaType, 'ANIME'), eq(title.isAdult, 0), eq(title.season, s.season), eq(title.year, s.year), isNotNull(title.avgScore)))
        .orderBy(desc(title.avgScore)).limit(TRENDING_LIMIT),
      db.select().from(title)
        .where(and(eq(title.isAdult, 0), gte(title.popularity, 1)))
        .orderBy(desc(title.popularity)).limit(TRENDING_LIMIT),
    ])
    return NextResponse.json({ seasonal, popular, season: s })
  } catch (e) {
    console.error('trending failed:', e)
    return apiError('trendingUnavailable', 502)
  }
}
