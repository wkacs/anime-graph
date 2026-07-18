import { NextRequest, NextResponse } from 'next/server'
import { fetchByMalIds, mapMedia, type AnilistMedia } from '@/lib/anilist'
import { parseMalXml } from '@/lib/import'
import { upsertImported } from '@/lib/import-upsert'

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const xml = String(body?.xml ?? '')
  if (!xml.includes('<anime>')) {
    return NextResponse.json({ error: 'Nem MAL-export XML' }, { status: 400 })
  }
  const entries = parseMalXml(xml)
  if (!entries.length) {
    return NextResponse.json({ error: 'Nincs anime a fájlban' }, { status: 400 })
  }

  // resolve MAL ids to AniList media in batches of 50
  const byMalId = new Map<number, AnilistMedia & { idMal: number }>()
  try {
    for (const chunk of chunks(entries.map((e) => e.malId), 50)) {
      for (const m of await fetchByMalIds(chunk)) byMalId.set(m.idMal, m)
    }
  } catch (e) {
    return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
  }

  const rows = []
  let notFound = 0
  for (const e of entries) {
    const media = byMalId.get(e.malId)
    if (!media) { notFound++; continue }
    rows.push({
      ...mapMedia(media),
      status: e.status,
      myScore: e.score,
      progress: e.progress,
      watchedAt: e.finishedAt ? new Date(`${e.finishedAt}T00:00:00.000Z`) : null,
    })
  }
  const result = await upsertImported(rows)
  return NextResponse.json({ ...result, notFound })
}
