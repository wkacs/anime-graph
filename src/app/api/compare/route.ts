import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { fetchUserList } from '@/lib/anilist'
import { compareLists, type TheirEntry } from '@/lib/compare'

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

  const theirs: TheirEntry[] = entries.map((e) => ({
    anilistId: e.media.id,
    title: e.media.title.romaji,
    coverUrl: e.media.coverImage?.large ?? null,
    score: e.score && e.score >= 1 ? Math.round(e.score) : null,
  }))

  const rows = await db.select().from(anime)
  const mine = rows.map((r) => ({
    anilistId: r.anilistId,
    title: r.titleRomaji,
    coverUrl: r.coverUrl,
    myScore: r.myScore,
  }))

  return NextResponse.json({ username, ...compareLists(mine, theirs) })
}
