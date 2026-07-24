import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, opinions } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { opinionQueue, type OpinionQueueInput } from '@/lib/opinion-queue'

export const dynamic = 'force-dynamic'

// A velemeny-varo oldal adatforrasa: sajat cimek LEFT JOIN velemenyek.
export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select({
    id: anime.id,
    titleRomaji: anime.titleRomaji,
    coverUrl: anime.coverUrl,
    status: anime.status,
    myScore: anime.myScore,
    createdAt: anime.createdAt,
    opinionId: opinions.id,
    extractStatus: opinions.extractStatus,
  }).from(anime)
    .leftJoin(opinions, eq(opinions.animeId, anime.id))
    .where(eq(anime.userId, userId))

  const items = opinionQueue(rows.map((r): OpinionQueueInput => ({
    id: r.id,
    titleRomaji: r.titleRomaji,
    coverUrl: r.coverUrl,
    status: r.status,
    myScore: r.myScore,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    hasOpinion: r.opinionId != null,
    extractStatus: r.extractStatus,
  })))

  if (req.nextUrl.searchParams.get('countOnly') === '1') {
    return NextResponse.json({ count: items.length })
  }
  return NextResponse.json({ items, count: items.length })
}
