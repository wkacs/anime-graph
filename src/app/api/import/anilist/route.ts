import { NextRequest, NextResponse } from 'next/server'
import { fetchUserList } from '@/lib/anilist'
import { mapTitle } from '@/lib/catalog'
import { mapAnilistStatus } from '@/lib/import'
import { upsertImported, type ImportRow } from '@/lib/import-upsert'
import { requireUserId } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // Az import külső API-t hív és tömegesen ír — egy elszabadult kliens percek
  // alatt megterhelné az AniList-kvótánkat és az adatbázist.
  if (!(await rateLimit('import', String(userId), 5, 3600))) {
    return apiError('tooManyImports', 429)
  }
  const body = await req.json().catch(() => null)
  const username = String(body?.username ?? '').trim()
  if (!username) return apiError('usernameRequired', 400)

  let entries
  try {
    // anime + manga lista együtt (a manga-hívás hibája nem dönti be az importot)
    const [animeList, mangaList] = await Promise.all([
      fetchUserList(username),
      fetchUserList(username, 'MANGA').catch(() => []),
    ])
    entries = [...animeList, ...mangaList]
  } catch (e) {
    return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
  }
  if (!entries.length) {
    return apiError('emptyOrPrivateList', 404)
  }

  const rows: ImportRow[] = entries.map((e) => {
    const c = e.completedAt
    return {
      meta: mapTitle(e.media),
      user: {
        status: mapAnilistStatus(e.status),
        myScore: e.score && e.score >= 1 ? Math.round(e.score) : null,
        progress: e.progress ?? 0,
        watchedAt: c?.year
          ? new Date(Date.UTC(c.year, (c.month ?? 1) - 1, c.day ?? 1))
          : null,
      },
    }
  })
  const result = await upsertImported(userId, rows)
  return NextResponse.json(result)
}
