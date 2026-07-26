import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteSignal } from '@/db/schema'
import { fetchSeason } from '@/lib/anilist'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { userLocale } from '@/lib/user-locale'
import { currentSeason, seasonScoreKind } from '@/lib/seasonal'
import { buildTasteVector, computeFit } from '@/lib/fit-score'
import { fitReason } from '@/lib/fit-reason'
import { requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const TTL_MS = 7 * 24 * 3600 * 1000
// GLM-hiba után rövid negatív cache, hogy a News-betöltések ne égessék a kvótát
const FAIL_TTL_MS = 3600 * 1000
// a séma legfeljebb 30 pontot enged vissza, a szezon-lekérés 25-öt hoz
const MAX_SCORED = 30

type StoredScore = { anilistId: number; title: string; score: number; reason: string }

// A jelenlegi szezon MINDEN címére ízlés-pont, hogy a News-rács rendezhető legyen.
// Ugyanaz a minta, mint a következő-szezon előnézeté (api/news/upcoming), csak
// itt nincs jelölt-szűkítés: minden kártyán legyen pont.
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const season = currentSeason(new Date())
  const kind = aiCacheKind(seasonScoreKind(season), await userLocale(userId))

  const cachedRows = await db.select().from(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  const cached = cachedRows[0]
  if (cached) {
    const result = cached.result as { items: StoredScore[]; failed?: boolean }
    const ttl = result.failed ? FAIL_TTL_MS : TTL_MS
    if (Date.now() - cached.createdAt.getTime() < ttl) {
      return NextResponse.json({ season, items: result.items, cached: true })
    }
  }

  const [rows, signals, seasonList] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select({
      feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
    }).from(tasteSignal).where(eq(tasteSignal.userId, userId)),
    fetchSeason(season.season, season.year).catch(() => []),
  ])
  if (!seasonList.length) return NextResponse.json({ season, items: [] })
  if (!rows.length) return NextResponse.json({ season, items: [] })

  const candidates = seasonList.slice(0, MAX_SCORED)
  const vector = buildTasteVector(rows, signals)
  const locale = await userLocale(userId)

  // Lokalis pontozas: nulla modellhivas. A cache marad, mert a fetchSeason
  // tovabbra is kulso halozati hivas.
  const items: StoredScore[] = candidates
    .map((c) => {
      const fit = computeFit(vector, { genres: c.genres, tags: c.tags ?? [] })
      return fit
        ? { anilistId: c.anilistId, title: c.title, score: fit.score, reason: fitReason(fit, locale) }
        : null
    })
    .filter((s): s is StoredScore => s !== null)
    .sort((a, b) => b.score - a.score)

  await db.delete(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
  await db.insert(recommendations).values({ userId, kind, input: season, result: { items } })
  return NextResponse.json({ season, items, cached: false })
}
