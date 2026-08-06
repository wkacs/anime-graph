import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, title } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { buildTasteVector, computeFit, computeDropRisk, relatedCount } from '@/lib/fit-score'
import { and, eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// Fit-score a katalógus-oldalra: „mennyire illik hozzád ez a cím?"
// Anonim látogatónak { fit: null, authed: false } (200) — a publikus oldal teasert mutat.
export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  const titleId = Number(new URL(req.url).searchParams.get('titleId'))
  if (!Number.isInteger(titleId) || titleId <= 0) {
    return apiError('titleIdRequired', 400)
  }
  if (!userId) return NextResponse.json({ fit: null, authed: false })

  const [target] = await db.select({ genres: title.genres, tags: title.tags })
    .from(title).where(and(eq(title.id, titleId), eq(title.isAdult, 0)))
  if (!target) return apiError('noSuchTitle', 404)

  const items = await db.select({
    genres: anime.genres, tags: anime.tags, status: anime.status, myScore: anime.myScore,
  }).from(anime).where(eq(anime.userId, userId))

  const fit = computeFit(buildTasteVector(items), target)
  const drop = computeDropRisk(items, target)
  // A megbizhatosag-fokozathoz a felulet a nyers szamlalokat kapja meg, nem a
  // kesz cimket: igy a „31 kapcsolodo cim" is kiirhato a badge alatt.
  return NextResponse.json({
    fit, drop, authed: true,
    sample: items.length,
    related: relatedCount(items, target),
  })
}
