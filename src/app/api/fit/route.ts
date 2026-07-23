import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, title } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { buildTasteVector, computeFit, computeDropRisk } from '@/lib/fit-score'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Fit-score a katalógus-oldalra: „mennyire illik hozzád ez a cím?"
// Anonim látogatónak { fit: null, authed: false } (200) — a publikus oldal teasert mutat.
export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  const titleId = Number(new URL(req.url).searchParams.get('titleId'))
  if (!Number.isInteger(titleId) || titleId <= 0) {
    return NextResponse.json({ error: 'titleId kötelező' }, { status: 400 })
  }
  if (!userId) return NextResponse.json({ fit: null, authed: false })

  const [target] = await db.select({ genres: title.genres, tags: title.tags })
    .from(title).where(eq(title.id, titleId))
  if (!target) return NextResponse.json({ error: 'nincs ilyen cím' }, { status: 404 })

  const items = await db.select({
    genres: anime.genres, tags: anime.tags, status: anime.status, myScore: anime.myScore,
  }).from(anime).where(eq(anime.userId, userId))

  const fit = computeFit(buildTasteVector(items), target)
  const drop = computeDropRisk(items, target)
  return NextResponse.json({ fit, drop, authed: true })
}
