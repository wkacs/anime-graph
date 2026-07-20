import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Owner-overlay data for a catalog title, keyed by titleId. Returns { owned: null }
// (HTTP 200) for anonymous or not-owned so the public page renders for everyone.
export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  const titleId = Number(new URL(req.url).searchParams.get('titleId'))
  if (!userId || !Number.isInteger(titleId) || titleId <= 0) {
    return NextResponse.json({ owned: null })
  }
  const [row] = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.titleId, titleId)))
  if (!row) return NextResponse.json({ owned: null })
  const [opinion] = await db.select().from(opinions).where(eq(opinions.animeId, row.id))
  const facts = await db.select({
    id: tasteMemory.id, animeId: tasteMemory.animeId, kind: tasteMemory.kind, text: tasteMemory.text,
  }).from(tasteMemory).where(eq(tasteMemory.animeId, row.id))
  return NextResponse.json({ owned: { anime: row, opinion: opinion ?? null, facts } })
}
