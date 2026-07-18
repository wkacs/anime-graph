import { NextRequest, NextResponse } from 'next/server'
import { fetchUserList, mapMedia } from '@/lib/anilist'
import { mapAnilistStatus } from '@/lib/import'
import { upsertImported } from '@/lib/import-upsert'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const username = String(body?.username ?? '').trim()
  if (!username) return NextResponse.json({ error: 'Felhasználónév kötelező' }, { status: 400 })

  let entries
  try {
    entries = await fetchUserList(username)
  } catch (e) {
    return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
  }
  if (!entries.length) {
    return NextResponse.json({ error: 'Üres vagy privát lista ezen a néven' }, { status: 404 })
  }

  const rows = entries.map((e) => {
    const c = e.completedAt
    return {
      ...mapMedia(e.media),
      status: mapAnilistStatus(e.status),
      myScore: e.score && e.score >= 1 ? Math.round(e.score) : null,
      progress: e.progress ?? 0,
      watchedAt: c?.year
        ? new Date(Date.UTC(c.year, (c.month ?? 1) - 1, c.day ?? 1))
        : null,
    }
  })
  const result = await upsertImported(rows)
  return NextResponse.json(result)
}
