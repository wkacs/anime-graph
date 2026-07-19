import { NextRequest, NextResponse } from 'next/server'
import { fetchBrowse } from '@/lib/anilist'
import { buildBrowseVariables, randomPage, type BrowseFilters } from '@/lib/browse'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

function parseFilters(sp: URLSearchParams): BrowseFilters {
  const type = sp.get('type') === 'MANGA' ? 'MANGA' as const : 'ANIME' as const
  const sortRaw = sp.get('sort')
  const sort = sortRaw === 'SCORE_DESC' || sortRaw === 'START_DATE_DESC' ? sortRaw : 'POPULARITY_DESC' as const
  return {
    type, sort,
    page: Math.max(1, Number(sp.get('page')) || 1),
    search: sp.get('search') || undefined,
    genre: sp.get('genre') || undefined,
    format: sp.get('format') || undefined,
    year: Number(sp.get('year')) || undefined,
    minScore: Number(sp.get('minScore')) || undefined,
  }
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const filters = parseFilters(sp)
  const vars = buildBrowseVariables(filters)
  vars.sort = [filters.sort]
  try {
    if (sp.get('random') === '1') {
      // perPage=1-es lapozással a cap 5000 TALÁLATIG enged
      const probe = await fetchBrowse({ ...vars, page: 1, perPage: 1 })
      if (!probe.total) return NextResponse.json({ error: 'Nincs találat ezekkel a szűrőkkel' }, { status: 404 })
      const page = randomPage(probe.total, 1)
      const pick = await fetchBrowse({ ...vars, page, perPage: 1 })
      return NextResponse.json({ media: pick.media })
    }
    const result = await fetchBrowse(vars)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
  }
}
