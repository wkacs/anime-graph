import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, title } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { buildTasteVector, computeFit } from '@/lib/fit-score'
import { and, eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const MAX_IDS = 100

// Batch fit-score lista-nézetekhez (böngésző, szezon-grid): egy user-vektor,
// sok célcím. Ahol nincs elég jel (null), az kimarad a válaszból.
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ scores: {}, authed: false })
  const body = await req.json().catch(() => ({}))
  const ids: number[] = Array.isArray(body.anilistIds)
    ? [...new Set<number>((body.anilistIds as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_IDS)
    : []
  if (!ids.length) return NextResponse.json({ scores: {}, authed: true })

  const [items, targets] = await Promise.all([
    db.select({ genres: anime.genres, tags: anime.tags, status: anime.status, myScore: anime.myScore })
      .from(anime).where(eq(anime.userId, userId)),
    db.select({ anilistId: title.anilistId, genres: title.genres, tags: title.tags })
      .from(title).where(and(eq(title.mediaType, 'ANIME'), eq(title.isAdult, 0), inArray(title.anilistId, ids))),
  ])
  const vector = buildTasteVector(items)
  const scores: Record<number, number> = {}
  for (const t of targets) {
    const fit = computeFit(vector, t)
    if (fit) scores[t.anilistId] = fit.score
  }
  return NextResponse.json({ scores, authed: true })
}
