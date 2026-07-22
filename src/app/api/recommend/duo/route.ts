import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory, users } from '@/db/schema'
import { fetchRecommendationsFor, type RecCandidate } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildDuoCandidates, buildDuoMessages, parseDuoPicks } from '@/lib/duo'
import { glmChat } from '@/lib/glm'
import { requireUserId } from '@/lib/session'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
const TTL_MS = 24 * 3600 * 1000

const toCand = (r: { anilistId: number; titleRomaji: string; coverUrl: string | null; genres: string[]; avgScore: number | null }): RecCandidate =>
  ({ anilistId: r.anilistId, title: r.titleRomaji, coverUrl: r.coverUrl, genres: r.genres, avgScore: r.avgScore })

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const otherUserId = Number(body?.otherUserId)
  if (!Number.isInteger(otherUserId) || otherUserId === userId) {
    return NextResponse.json({ error: 'otherUserId kötelező' }, { status: 400 })
  }
  const [other] = await db.select().from(users).where(eq(users.id, otherUserId))
  if (!other) return NextResponse.json({ error: 'Nincs ilyen user' }, { status: 404 })

  const kind = `duo:${Math.min(userId, otherUserId)}:${Math.max(userId, otherUserId)}`
  const cachedRows = await db.select().from(recommendations)
    .where(eq(recommendations.kind, kind))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  const cached = cachedRows[0]
  if (cached && Date.now() - cached.createdAt.getTime() < TTL_MS && body?.force !== true) {
    return NextResponse.json({ ...(cached.result as object), cached: true, otherUsername: other.username })
  }

  const [mine, theirs, myFactRows, theirFactRows] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(anime).where(eq(anime.userId, otherUserId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, otherUserId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
  ])
  const watchedStatuses = new Set(['watching', 'completed', 'dropped'])
  const excludeIds = new Set([
    ...mine.filter((r) => watchedStatuses.has(r.status)).map((r) => r.anilistId),
    ...theirs.filter((r) => watchedStatuses.has(r.status)).map((r) => r.anilistId),
  ])
  // közös kedvencek (mindkettő >= 8) AniList-recjei
  const theirScores = new Map(theirs.map((r) => [r.anilistId, r.myScore]))
  const sharedFavs = mine.filter((r) => (r.myScore ?? 0) >= 8 && (theirScores.get(r.anilistId) ?? 0) >= 8).slice(0, 5)
  const recPools = await Promise.all(sharedFavs.map((f) => fetchRecommendationsFor(f.anilistId).catch(() => [])))

  const candidates = buildDuoCandidates({
    myPlanned: mine.filter((r) => r.status === 'planned').map(toCand),
    theirPlanned: theirs.filter((r) => r.status === 'planned').map(toCand),
    recPool: recPools.flat(),
    excludeIds,
  })
  if (!candidates.length) return NextResponse.json({ error: 'Nincs közös jelölt — adjatok hozzá terveket' }, { status: 400 })

  await consumeAiQuota(userId, 'duo')
  const messages = buildDuoMessages(
    candidates,
    myFactRows.map((f) => f.text),
    theirFactRows.map((f) => f.text),
    'a kérdező', other.username,
  )
  const picks = parseDuoPicks(await glmChat(messages, { userId, endpoint: 'duo' }))
  const byId = new Map(candidates.map((c) => [c.anilistId, c]))
  const result = {
    picks: picks
      .filter((p) => byId.has(p.anilistId))
      .map((p) => ({ ...p, title: byId.get(p.anilistId)!.title, coverUrl: byId.get(p.anilistId)!.coverUrl })),
  }
  await db.insert(recommendations).values({ userId, kind, input: { otherUserId }, result })
  return NextResponse.json({ ...result, cached: false, otherUsername: other.username })
}
