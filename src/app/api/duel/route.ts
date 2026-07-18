import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, duels } from '@/db/schema'
import { eloUpdate, pickDuelPair } from '@/lib/elo'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select().from(anime)
  const pair = pickDuelPair(rows)
  if (!pair) {
    return NextResponse.json({ error: 'Legalább két anime kell a duelhez' }, { status: 400 })
  }
  return NextResponse.json({ pair })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const winnerId = Number(body?.winnerId)
  const loserId = Number(body?.loserId)
  if (!winnerId || !loserId || winnerId === loserId) {
    return NextResponse.json({ error: 'winnerId és loserId kötelező' }, { status: 400 })
  }
  const [winner] = await db.select().from(anime).where(eq(anime.id, winnerId))
  const [loser] = await db.select().from(anime).where(eq(anime.id, loserId))
  if (!winner || !loser) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })

  const updated = eloUpdate(winner.elo, loser.elo)
  await db.update(anime).set({ elo: updated.winner }).where(eq(anime.id, winnerId))
  await db.update(anime).set({ elo: updated.loser }).where(eq(anime.id, loserId))
  await db.insert(duels).values({ winnerId, loserId })

  return NextResponse.json({
    winner: { id: winnerId, elo: updated.winner },
    loser: { id: loserId, elo: updated.loser },
  })
}
