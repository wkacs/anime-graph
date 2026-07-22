import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { fetchSeason } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { genreWeights, rankCandidates } from '@/lib/candidates'
import { buildSeasonMessages, nextSeason, parseSeasonScores } from '@/lib/seasonal'
import { glmChat } from '@/lib/glm'
import { requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
const TTL_MS = 7 * 24 * 3600 * 1000
// GLM-hiba után rövid negatív cache, hogy a News-betöltések ne égessék a kvótát
const FAIL_TTL_MS = 3600 * 1000

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const season = nextSeason(new Date())
  const kind = `seasonal-ai:${season.year}-${season.season}`

  const cachedRows = await db.select().from(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  const cached = cachedRows[0]
  if (cached) {
    const result = cached.result as { items: unknown[]; failed?: boolean }
    const ttl = result.failed ? FAIL_TTL_MS : TTL_MS
    if (Date.now() - cached.createdAt.getTime() < ttl) {
      return NextResponse.json({ season, items: result.items, cached: true })
    }
  }

  const [rows, facts, seasonList] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
    fetchSeason(season.season, season.year).catch(() => []),
  ])
  if (!seasonList.length) return NextResponse.json({ season, items: [] })

  const owned = new Set(rows.map((r) => r.anilistId))
  const pre = rankCandidates(seasonList, owned, genreWeights(rows), 20)
  if (!pre.length) return NextResponse.json({ season, items: [] })
  try {
    await consumeAiQuota(userId, 'upcoming')
    const scores = parseSeasonScores(await glmChat(buildSeasonMessages(pre, facts.map((f) => f.text)), { userId, endpoint: 'upcoming' }))
    const byId = new Map(seasonList.map((s) => [s.anilistId, s]))
    const items = scores
      .sort((a, b) => b.score - a.score).slice(0, 8)
      .filter((s) => byId.has(s.anilistId))
      .map((s) => ({ ...byId.get(s.anilistId)!, tasteScore: s.score, tasteReason: s.reason, owned: owned.has(s.anilistId) }))
    await db.delete(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
    await db.insert(recommendations).values({ userId, kind, input: season, result: { items } })
    return NextResponse.json({ season, items, cached: false })
  } catch (e) {
    await db.insert(recommendations)
      .values({ userId, kind, input: season, result: { items: [], failed: true } })
      .catch(() => { /* a negatív cache best-effort */ })
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
