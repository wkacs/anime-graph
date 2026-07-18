import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, duels } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  const duelRows = await db.select().from(duels)
    .where(eq(duels.userId, userId))
    .orderBy(desc(duels.createdAt)).limit(10)
  const titleById = new Map(rows.map((r) => [r.id, { title: r.titleRomaji, coverUrl: r.coverUrl }]))

  const top = [...rows]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 20)
    .map((r) => ({
      animeId: r.id,
      title: r.titleRomaji,
      coverUrl: r.coverUrl,
      elo: Math.round(r.elo),
      myScore: r.myScore,
    }))

  const history = duelRows
    .map((d) => ({
      winner: titleById.get(d.winnerId)?.title ?? '?',
      loser: titleById.get(d.loserId)?.title ?? '?',
      at: d.createdAt,
    }))

  return NextResponse.json({ top, history, totalDuels: duelRows.length })
}
