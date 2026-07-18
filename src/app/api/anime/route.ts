import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory } from '@/db/schema'
import { fetchMedia, mapMedia } from '@/lib/anilist'
import { eq } from 'drizzle-orm'

// DB-backed GET must not be statically executed at build time
export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select().from(anime)
  const facts = await db.select({
    id: tasteMemory.id,
    animeId: tasteMemory.animeId,
    kind: tasteMemory.kind,
    text: tasteMemory.text,
  }).from(tasteMemory)
  return NextResponse.json({ anime: rows, facts })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const anilistId = Number(body?.anilistId)
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'anilistId kötelező' }, { status: 400 })
  }
  const existing = await db.select().from(anime).where(eq(anime.anilistId, anilistId))
  if (existing.length) return NextResponse.json({ anime: existing[0] })
  const media = await fetchMedia(anilistId)
  const [row] = await db.insert(anime).values(mapMedia(media)).returning()
  return NextResponse.json({ anime: row }, { status: 201 })
}
