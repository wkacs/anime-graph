import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, settings, title } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { buildTasteVector } from '@/lib/fit-score'
import { compatScore } from '@/lib/compat'
import { and, eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// Ízlés-kompatibilitás a publikus profilon (D4): a bejelentkezett néző és a
// profil-tulajdonos egyezése. Csak aggregátum megy ki, címlista/vélemény soha.
export async function GET(req: NextRequest) {
  const viewerId = await requireUserId()
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!token) return apiError('tokenRequired', 400)
  if (!viewerId) return NextResponse.json({ compat: null, authed: false })

  const tokenRows = await db.select().from(settings).where(eq(settings.key, 'publicToken'))
  const match = tokenRows.find((r) => r.value === token)
  if (!match) return apiError('invalidLink', 404)
  if (match.userId === viewerId) return NextResponse.json({ compat: null, authed: true, self: true })

  const select = { genres: anime.genres, tags: anime.tags, status: anime.status, myScore: anime.myScore }
  const [mine, theirs] = await Promise.all([
    db.select(select).from(anime)
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(and(eq(anime.userId, viewerId), eq(title.isAdult, 0))),
    db.select(select).from(anime)
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(and(eq(anime.userId, match.userId), eq(title.isAdult, 0))),
  ])
  const compat = compatScore(buildTasteVector(mine), buildTasteVector(theirs))
  return NextResponse.json({ compat, authed: true })
}
