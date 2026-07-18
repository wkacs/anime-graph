import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory, recommendations } from '@/db/schema'
import { fetchSeason } from '@/lib/anilist'
import { currentSeason, buildSeasonMessages, parseSeasonScores } from '@/lib/seasonal'
import { glmChat } from '@/lib/glm'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

type SeasonInput = { season: string; year: number }

async function findCached(input: SeasonInput) {
  const rows = await db.select().from(recommendations)
    .where(eq(recommendations.kind, 'seasonal'))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  const latest = rows[0]
  if (!latest) return null
  const li = latest.input as SeasonInput
  if (li.season !== input.season || li.year !== input.year) return null
  return latest.result
}

async function runScoring(input: SeasonInput) {
  const [candidatesRaw, owned, factRows] = await Promise.all([
    fetchSeason(input.season, input.year),
    db.select({ anilistId: anime.anilistId }).from(anime),
    db.select().from(tasteMemory),
  ])
  const ownedSet = new Set(owned.map((o) => o.anilistId))
  const candidates = candidatesRaw.filter((c) => !ownedSet.has(c.anilistId)).slice(0, 20)
  if (!candidates.length) return { season: input, items: [] }

  const facts = factRows.map((f) => `(${f.kind}) ${f.text}`).slice(0, 60)
  const raw = await glmChat(buildSeasonMessages(candidates, facts))
  const scores = parseSeasonScores(raw)
  const byId = new Map(candidates.map((c) => [c.anilistId, c]))
  const items = scores
    .filter((s) => byId.has(s.anilistId))
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ...byId.get(s.anilistId)!, score: s.score, reason: s.reason }))

  const result = { season: input, items }
  await db.insert(recommendations).values({ kind: 'seasonal', input, result })
  return result
}

export async function GET() {
  const input = currentSeason(new Date())
  const cached = await findCached(input)
  if (cached) return NextResponse.json({ ...(cached as object), cached: true })
  try {
    const result = await runScoring(input)
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}

export async function POST(_req: NextRequest) {
  // force refresh, ignoring the cache
  const input = currentSeason(new Date())
  try {
    const result = await runScoring(input)
    return NextResponse.json({ ...result, cached: false })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
