import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, settings } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { buildTasteVector } from '@/lib/fit-score'
import { compatScore } from '@/lib/compat'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Ízlés-kompatibilitás a publikus profilon (D4): a bejelentkezett néző és a
// profil-tulajdonos egyezése. Csak aggregátum megy ki, címlista/vélemény soha.
export async function GET(req: NextRequest) {
  const viewerId = await requireUserId()
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ error: 'token kötelező' }, { status: 400 })
  if (!viewerId) return NextResponse.json({ compat: null, authed: false })

  const tokenRows = await db.select().from(settings).where(eq(settings.key, 'publicToken'))
  const match = tokenRows.find((r) => r.value === token)
  if (!match) return NextResponse.json({ error: 'érvénytelen link' }, { status: 404 })
  if (match.userId === viewerId) return NextResponse.json({ compat: null, authed: true, self: true })

  const select = { genres: anime.genres, tags: anime.tags, status: anime.status, myScore: anime.myScore }
  const [mine, theirs] = await Promise.all([
    db.select(select).from(anime).where(eq(anime.userId, viewerId)),
    db.select(select).from(anime).where(eq(anime.userId, match.userId)),
  ])
  const compat = compatScore(buildTasteVector(mine), buildTasteVector(theirs))
  return NextResponse.json({ compat, authed: true })
}
