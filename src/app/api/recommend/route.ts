import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, title, titleRecommendations, recommendations, tasteSignal } from '@/db/schema'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { userLocale } from '@/lib/user-locale'
import { buildLocalCandidates } from '@/lib/local-candidates'
import { buildTasteVector, computeFit } from '@/lib/fit-score'
import { fitReason } from '@/lib/fit-reason'
import { requireUserId } from '@/lib/session'
import { and, eq, inArray } from 'drizzle-orm'

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.mediaType, 'ANIME')))
  if (!rows.length) {
    return NextResponse.json({ error: 'Előbb adj hozzá animéket' }, { status: 400 })
  }

  // top 5 by my score → lokális jelöltlista a title katalógusból (nincs élő AniList-hívás)
  const top = [...rows]
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))
    .slice(0, 5)
  const favorites = top.map((t) => ({
    anilistId: t.anilistId, genres: t.genres,
    relations: (t.relations ?? []).map((r) => r.anilistId),
  }))
  const catalog = await db.select({
    anilistId: title.anilistId, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
    genres: title.genres, tags: title.tags,
    communityScore: title.communityScore, avgScore: title.avgScore,
    relations: title.relations,
  }).from(title).where(and(eq(title.mediaType, 'ANIME'), eq(title.isAdult, 0)))
  const owned = new Set(rows.map((r) => r.anilistId))
  // batch-cache-elt AniList-recs (heti sync) a kedvenc címekre — kollaboratív jel élő hívás nélkül
  const topIds = top.map((t) => t.anilistId)
  const recRows = topIds.length
    ? await db.select({ recAnilistId: titleRecommendations.recAnilistId })
        .from(titleRecommendations).where(inArray(titleRecommendations.anilistId, topIds))
    : []
  const recIds = new Set(recRows.map((r) => r.recAnilistId))
  const candidates = buildLocalCandidates(favorites, catalog, owned, 200, recIds)
  if (!candidates.length) {
    return NextResponse.json({ error: 'Nincs elég katalógus-adat az ajánláshoz' }, { status: 502 })
  }
  const signals = await db.select({
    feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
  }).from(tasteSignal).where(eq(tasteSignal.userId, userId))
  const vector = buildTasteVector(rows, signals)
  const locale = await userLocale(userId)

  // Lokalis rangsor: nulla modellhivas. A "miert" a vektorbol jon (fit-reason),
  // AI-proza csak a /api/recommend/explain vegponton, gombnyomasra.
  const result = candidates
    .map((c) => {
      const fit = computeFit(vector, { genres: c.genres, tags: c.tags ?? [] })
      return fit ? { ...c, score: fit.score, reason: fitReason(fit, locale) } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  if (!result.length) {
    return NextResponse.json({ error: 'Nincs elég adat az ajánláshoz' }, { status: 502 })
  }

  await db.insert(recommendations).values({
    userId,
    kind: aiCacheKind('recommend', locale),
    input: { topTitles: top.map((t) => t.titleRomaji), candidateCount: candidates.length },
    result,
  })
  return NextResponse.json({ picks: result })
}
