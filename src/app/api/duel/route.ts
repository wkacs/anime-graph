import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, duels } from '@/db/schema'
import { eloUpdate, pickDuelPair } from '@/lib/elo'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const PAIR_COOKIE = 'duel-pair'

// the issued pair travels in a short-lived cookie and is single-use:
// a vote must match the last pair actually served to this browser
// (guards against ghost/duplicate submissions inflating the elo)
function pairKey(a: number, b: number): string {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return `${lo}:${hi}`
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  const pair = pickDuelPair(rows)
  if (!pair) {
    return NextResponse.json({ error: 'Legalább két anime kell a duelhez' }, { status: 400 })
  }
  const res = NextResponse.json({ pair })
  res.cookies.set(PAIR_COOKIE, pairKey(pair[0].id, pair[1].id), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/duel',
  })
  return res
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const winnerId = Number(body?.winnerId)
  const loserId = Number(body?.loserId)
  if (!winnerId || !loserId || winnerId === loserId) {
    return NextResponse.json({ error: 'winnerId és loserId kötelező' }, { status: 400 })
  }

  const issued = req.cookies.get(PAIR_COOKIE)?.value
  if (issued !== pairKey(winnerId, loserId)) {
    return NextResponse.json(
      { error: 'Érvénytelen vagy elhasznált pár — kérj új párost' },
      { status: 409 },
    )
  }

  const [winner] = await db.select().from(anime)
    .where(and(eq(anime.id, winnerId), eq(anime.userId, userId)))
  const [loser] = await db.select().from(anime)
    .where(and(eq(anime.id, loserId), eq(anime.userId, userId)))
  if (!winner || !loser) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })

  const updated = eloUpdate(winner.elo, loser.elo)
  await db.update(anime).set({ elo: updated.winner }).where(eq(anime.id, winnerId))
  await db.update(anime).set({ elo: updated.loser }).where(eq(anime.id, loserId))
  await db.insert(duels).values({ userId, winnerId, loserId })

  const res = NextResponse.json({
    winner: { id: winnerId, elo: updated.winner },
    loser: { id: loserId, elo: updated.loser },
  })
  // single-use: clear so a repeated submission of the same pair is rejected
  res.cookies.set(PAIR_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/api/duel' })
  return res
}
