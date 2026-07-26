import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, title, titleRecommendations, tasteMemory, recommendations } from '@/db/schema'
import { genreWeights, rankCandidates } from '@/lib/candidates'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { userLocale } from '@/lib/user-locale'
import { buildLocalCandidates } from '@/lib/local-candidates'
import { buildRecommendMessages, parsePicks } from '@/lib/recommend'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { glmChat } from '@/lib/glm'
import { aiUserErrorMessage } from '@/lib/ai-error'
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
    genres: title.genres, communityScore: title.communityScore, avgScore: title.avgScore,
    relations: title.relations,
  }).from(title).where(eq(title.mediaType, 'ANIME'))
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
  const weights = genreWeights(rows)
  const ranked = rankCandidates(candidates, owned, weights, 30)

  const factRows = await db.select({
    kind: tasteMemory.kind,
    text: tasteMemory.text,
    animeId: tasteMemory.animeId,
  }).from(tasteMemory).where(eq(tasteMemory.userId, userId))
  const titleById = new Map(rows.map((r) => [r.id, r.titleRomaji]))
  const facts = factRows.map((f) => ({
    kind: f.kind, text: f.text,
    title: f.animeId != null ? titleById.get(f.animeId) ?? null : null,
  }))

  const extras = {
    dropped: rows.filter((r) => r.status === 'dropped').slice(0, 8).map((r) => r.titleRomaji),
  }

  const locale = await userLocale(userId)

  try {
    await consumeAiQuota(userId, 'recommend')
    const raw = await glmChat(
      buildRecommendMessages(ranked, facts, top.map((t) => t.titleRomaji), locale, extras),
      { userId, endpoint: 'recommend' },
    )
    const picks = parsePicks(raw)
    const byId = new Map(ranked.map((c) => [c.anilistId, c]))
    const result = picks
      .filter((p) => byId.has(p.anilistId))
      .map((p) => ({ ...byId.get(p.anilistId)!, reason: p.reason }))
    await db.insert(recommendations).values({
      userId,
      kind: aiCacheKind('recommend', locale),
      input: { topTitles: top.map((t) => t.titleRomaji), candidateCount: ranked.length },
      result,
    })
    return NextResponse.json({ picks: result })
  } catch (e) {
    console.error('recommend failed:', e)
    return NextResponse.json({ error: aiUserErrorMessage(e) }, { status: 502 })
  }
}
