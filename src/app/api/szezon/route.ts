import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory, recommendations } from '@/db/schema'
import { fetchSeason } from '@/lib/anilist'
import { currentSeason, buildSeasonMessages, parseSeasonScores } from '@/lib/seasonal'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { glmChat } from '@/lib/glm'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

type SeasonInput = { season: string; year: number }

async function findCached(userId: number, input: SeasonInput) {
  const rows = await db.select().from(recommendations)
    .where(and(eq(recommendations.kind, 'seasonal'), eq(recommendations.userId, userId)))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  const latest = rows[0]
  if (!latest) return null
  const li = latest.input as SeasonInput
  if (li.season !== input.season || li.year !== input.year) return null
  return latest.result
}

async function runScoring(userId: number, input: SeasonInput) {
  const [candidatesRaw, owned, factRows] = await Promise.all([
    fetchSeason(input.season, input.year),
    db.select({ anilistId: anime.anilistId }).from(anime).where(eq(anime.userId, userId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)),
  ])
  const ownedSet = new Set(owned.map((o) => o.anilistId))
  const candidates = candidatesRaw.filter((c) => !ownedSet.has(c.anilistId)).slice(0, 20)
  if (!candidates.length) return { season: input, items: [] }

  const facts = factRows.map((f) => `(${f.kind}) ${f.text}`).slice(0, 60)
  await consumeAiQuota(userId)
  const raw = await glmChat(buildSeasonMessages(candidates, facts))
  const scores = parseSeasonScores(raw)
  const byId = new Map(candidates.map((c) => [c.anilistId, c]))
  const items = scores
    .filter((s) => byId.has(s.anilistId))
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ...byId.get(s.anilistId)!, score: s.score, reason: s.reason }))

  const result = { season: input, items }
  await db.insert(recommendations).values({ userId, kind: 'seasonal', input, result })
  return result
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const input = currentSeason(new Date())
  const cached = await findCached(userId, input)
  if (cached) return NextResponse.json({ ...(cached as object), cached: true })
  try {
    const result = await runScoring(userId, input)
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}

export async function POST() {
  // force refresh, ignoring the cache
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const input = currentSeason(new Date())
  try {
    const result = await runScoring(userId, input)
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
