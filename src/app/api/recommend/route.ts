import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, duels, tasteMemory, recommendations } from '@/db/schema'
import { fetchRecommendationsFor, type RecCandidate } from '@/lib/anilist'
import { genreWeights, rankCandidates } from '@/lib/candidates'
import { buildRecommendMessages, parsePicks } from '@/lib/recommend'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { glmChat } from '@/lib/glm'
import { desc, eq } from 'drizzle-orm'

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  if (!rows.length) {
    return NextResponse.json({ error: 'Előbb adj hozzá animéket' }, { status: 400 })
  }

  // top 5 by my score (fallback elo) → pull AniList recommendations for each
  const top = [...rows]
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0) || b.elo - a.elo)
    .slice(0, 5)
  const pools = await Promise.allSettled(top.map((t) => fetchRecommendationsFor(t.anilistId)))
  const candidates: RecCandidate[] = pools
    .filter((p): p is PromiseFulfilledResult<RecCandidate[]> => p.status === 'fulfilled')
    .flatMap((p) => p.value)
  if (!candidates.length) {
    return NextResponse.json({ error: 'AniList nem adott jelölteket, próbáld újra' }, { status: 502 })
  }

  const owned = new Set(rows.map((r) => r.anilistId))
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

  // duel-derived signals: only meaningful once actual duels happened
  const duelRows = await db.select().from(duels)
    .where(eq(duels.userId, userId))
    .orderBy(desc(duels.createdAt)).limit(8)
  const extras = {
    eloTop: duelRows.length
      ? [...rows].sort((a, b) => b.elo - a.elo).slice(0, 5).map((r) => r.titleRomaji)
      : [],
    dropped: rows.filter((r) => r.status === 'dropped').slice(0, 8).map((r) => r.titleRomaji),
    recentDuels: duelRows
      .map((d) => {
        const w = titleById.get(d.winnerId)
        const l = titleById.get(d.loserId)
        return w && l ? `${w} > ${l}` : null
      })
      .filter((x): x is string => x !== null),
  }

  try {
    await consumeAiQuota(userId)
    const raw = await glmChat(buildRecommendMessages(ranked, facts, top.map((t) => t.titleRomaji), extras))
    const picks = parsePicks(raw)
    const byId = new Map(ranked.map((c) => [c.anilistId, c]))
    const result = picks
      .filter((p) => byId.has(p.anilistId))
      .map((p) => ({ ...byId.get(p.anilistId)!, reason: p.reason }))
    await db.insert(recommendations).values({
      userId,
      kind: 'recommend',
      input: { topTitles: top.map((t) => t.titleRomaji), candidateCount: ranked.length },
      result,
    })
    return NextResponse.json({ picks: result })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
