import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { buildProfileMessages, parseProfile } from '@/lib/profile'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { userLocale } from '@/lib/user-locale'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { glmChat } from '@/lib/glm'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function generate(userId: number) {
  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  const factRows = await db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId))
  if (!rows.length) return null

  const genreCounts = new Map<string, number>()
  for (const a of rows) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const topGenres = [...genreCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([g]) => g)
  const topTitles = [...rows]
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))
    .slice(0, 5).map((r) => r.titleRomaji)
  const facts = factRows.map((f) => `(${f.kind}) ${f.text}`).slice(0, 60)

  await consumeAiQuota(userId, 'profile')
  const locale = await userLocale(userId)
  const raw = await glmChat(
    buildProfileMessages(facts, topGenres, topTitles, rows.length, locale),
    { userId, endpoint: 'profile' },
  )
  const profile = parseProfile(raw)
  await db.insert(recommendations).values({
    userId,
    kind: aiCacheKind('profile', locale),
    input: { factCount: factRows.length },
    result: profile,
  })
  return profile
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const locale = await userLocale(userId)
  const cached = await db.select().from(recommendations)
    .where(and(eq(recommendations.kind, aiCacheKind('profile', locale)), eq(recommendations.userId, userId)))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  const factCount = (await db.select({ id: tasteMemory.id }).from(tasteMemory)
    .where(eq(tasteMemory.userId, userId))).length
  const latest = cached[0]
  // amíg nem gyűlt új ízlés-tény, a tárolt portré érvényes
  if (latest && (latest.input as { factCount?: number }).factCount === factCount) {
    return NextResponse.json({ profile: latest.result, cached: true })
  }
  try {
    const profile = await generate(userId)
    return NextResponse.json({ profile, cached: false })
  } catch (e) {
    if (latest) return NextResponse.json({ profile: latest.result, cached: true, stale: true })
    return NextResponse.json({ profile: null, error: String(e) })
  }
}

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const profile = await generate(userId)
    return NextResponse.json({ profile, cached: false })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
