import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { fetchSeason } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildSeasonMessages, currentSeason, parseSeasonScores, seasonScoreKind } from '@/lib/seasonal'
import { glmChat } from '@/lib/glm'
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
  const kind = seasonScoreKind(season)

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

  const [rows, facts, seasonList] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
    fetchSeason(season.season, season.year).catch(() => []),
  ])
  if (!seasonList.length) return NextResponse.json({ season, items: [] })
  if (!rows.length) return NextResponse.json({ season, items: [] })

  const candidates = seasonList.slice(0, MAX_SCORED)
  const titleById = new Map(candidates.map((c) => [c.anilistId, c.title]))
  try {
    await consumeAiQuota(userId, 'season-scores')
    const scores = parseSeasonScores(await glmChat(buildSeasonMessages(candidates, facts.map((f) => f.text)), { userId, endpoint: 'season-scores' }))
    const items: StoredScore[] = scores
      .filter((s) => titleById.has(s.anilistId))
      .map((s) => ({ anilistId: s.anilistId, title: titleById.get(s.anilistId)!, score: s.score, reason: s.reason }))
      .sort((a, b) => b.score - a.score)
    await db.delete(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
    await db.insert(recommendations).values({ userId, kind, input: season, result: { items } })
    return NextResponse.json({ season, items, cached: false })
  } catch (e) {
    await db.delete(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
      .catch(() => { /* a negatív cache best-effort */ })
    await db.insert(recommendations)
      .values({ userId, kind, input: season, result: { items: [], failed: true } })
      .catch(() => { /* a negatív cache best-effort */ })
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
