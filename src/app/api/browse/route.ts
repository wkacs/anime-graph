import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { type BrowseFilters } from '@/lib/browse'
import { browseWhere, browseOrder, resolveSeason } from '@/lib/browse-local'
import { and, eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function parseFilters(sp: URLSearchParams): BrowseFilters {
  const type = sp.get('type') === 'MANGA' ? 'MANGA' as const : 'ANIME' as const
  const sortRaw = sp.get('sort')
  const sort = sortRaw === 'SCORE_DESC' || sortRaw === 'START_DATE_DESC' ? sortRaw : 'POPULARITY_DESC' as const
  const sk = sp.get('season')
  const season = sk === 'current' || sk === 'next' ? resolveSeason(sk, new Date()) : null
  return {
    type, sort,
    page: Math.max(1, Number(sp.get('page')) || 1),
    search: sp.get('search') || undefined,
    genre: sp.get('genre') || undefined,
    format: sp.get('format') || undefined,
    year: Number(sp.get('year')) || undefined,
    minScore: Number(sp.get('minScore')) || undefined,
    studio: sp.get('studio') || undefined,
    season: season?.season,
    seasonYear: season?.year,
  }
}

// A Böngésző UI a /api/search (katalógus) felől olvas; ez a route a title katalógusból
// szolgálja ki a szűrt/rendezett listát élő AniList-hívás NÉLKÜL.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const filters = parseFilters(sp)
  try {
    const where = and(browseWhere(filters), eq(title.isAdult, 0))
    const perPage = 30
    if (sp.get('random') === '1') {
      const [pick] = await db.select().from(title).where(where).orderBy(sql`random()`).limit(1)
      if (!pick) return NextResponse.json({ error: 'Nincs találat ezekkel a szűrőkkel' }, { status: 404 })
      return NextResponse.json({ media: [pick] })
    }
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(title).where(where)
    const media = await db.select().from(title).where(where)
      .orderBy(browseOrder(filters.sort)).limit(perPage).offset((filters.page - 1) * perPage)
    return NextResponse.json({ total, media })
  } catch (e) {
    console.error('browse failed:', e)
    return NextResponse.json({ error: 'A böngésző most nem elérhető' }, { status: 502 })
  }
}
