import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { buildProfileMessages, parseProfile } from '@/lib/profile'
import { glmChat } from '@/lib/glm'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function generate() {
  const rows = await db.select().from(anime)
  const factRows = await db.select().from(tasteMemory)
  if (!rows.length) return null

  const genreCounts = new Map<string, number>()
  for (const a of rows) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const topGenres = [...genreCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([g]) => g)
  const topTitles = [...rows]
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0) || b.elo - a.elo)
    .slice(0, 5).map((r) => r.titleRomaji)
  const facts = factRows.map((f) => `(${f.kind}) ${f.text}`).slice(0, 60)

  const raw = await glmChat(buildProfileMessages(facts, topGenres, topTitles, rows.length))
  const profile = parseProfile(raw)
  await db.insert(recommendations).values({
    kind: 'profile',
    input: { factCount: factRows.length },
    result: profile,
  })
  return profile
}

export async function GET() {
  const cached = await db.select().from(recommendations)
    .where(eq(recommendations.kind, 'profile'))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  const factCount = (await db.select({ id: tasteMemory.id }).from(tasteMemory)).length
  const latest = cached[0]
  // amíg nem gyűlt új ízlés-tény, a tárolt portré érvényes
  if (latest && (latest.input as { factCount?: number }).factCount === factCount) {
    return NextResponse.json({ profile: latest.result, cached: true })
  }
  try {
    const profile = await generate()
    return NextResponse.json({ profile, cached: false })
  } catch (e) {
    if (latest) return NextResponse.json({ profile: latest.result, cached: true, stale: true })
    return NextResponse.json({ profile: null, error: String(e) })
  }
}

export async function POST() {
  try {
    const profile = await generate()
    return NextResponse.json({ profile, cached: false })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
