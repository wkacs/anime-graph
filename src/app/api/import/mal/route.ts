import { NextRequest, NextResponse } from 'next/server'
import { fetchByMalIds, type AnilistMedia } from '@/lib/anilist'
import { mapTitle } from '@/lib/catalog'
import { parseMalXml } from '@/lib/import'
import { upsertImported, type ImportRow } from '@/lib/import-upsert'
import { requireUserId } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'

const MAX_XML_CHARS = 10 * 1024 * 1024
const MAX_ENTRIES = 10_000

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // Az import külső API-t hív és tömegesen ír — egy elszabadult kliens percek
  // alatt megterhelné az AniList-kvótánkat és az adatbázist.
  if (!(await rateLimit('import', String(userId), 5, 3600))) {
    return apiError('tooManyImports', 429)
  }
  const body = await req.json().catch(() => null)
  const xml = String(body?.xml ?? '')
  if (xml.length > MAX_XML_CHARS) {
    return NextResponse.json({ error: 'A MAL export legfeljebb 10 MB lehet' }, { status: 413 })
  }
  if (!xml.includes('<anime>')) {
    return NextResponse.json({ error: 'Nem MAL-export XML' }, { status: 400 })
  }
  const entries = parseMalXml(xml)
  if (!entries.length) {
    return apiError('noAnimeInFile', 400)
  }
  if (entries.length > MAX_ENTRIES) {
    return apiError('exportTooLarge', 413)
  }

  // resolve MAL ids to AniList media in batches of 50
  const byMalId = new Map<number, AnilistMedia & { idMal: number }>()
  let unavailable = 0
  for (const chunk of chunks(entries.map((e) => e.malId), 50)) {
    try {
      for (const m of await fetchByMalIds(chunk)) byMalId.set(m.idMal, m)
    } catch (e) {
      console.warn('MAL import AniList batch failed:', String(e))
      unavailable += chunk.length
    }
  }
  if (!byMalId.size && unavailable) {
    return apiError('anilistDown', 503)
  }

  const rows: ImportRow[] = []
  let notFound = 0
  for (const e of entries) {
    const media = byMalId.get(e.malId)
    if (!media) { notFound++; continue }
    rows.push({
      meta: mapTitle(media),
      user: {
        status: e.status,
        myScore: e.score,
        progress: e.progress,
        watchedAt: e.finishedAt ? new Date(`${e.finishedAt}T00:00:00.000Z`) : null,
      },
    })
  }
  const result = await upsertImported(userId, rows)
  return NextResponse.json({ ...result, notFound, unavailable })
}
