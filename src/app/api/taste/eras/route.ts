import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { recommendations, tasteMemory } from '@/db/schema'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildErasMessages, parseEras } from '@/lib/evolution'
import { glmChat } from '@/lib/glm'
import { requireUserId } from '@/lib/session'
import { and, asc, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, 'taste-eras')))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  return NextResponse.json({ eras: rows[0] ? (rows[0].result as { eras: unknown }).eras : null })
}

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const facts = await db.select().from(tasteMemory)
    .where(eq(tasteMemory.userId, userId))
    .orderBy(asc(tasteMemory.createdAt))
  if (facts.length < 8) return NextResponse.json({ error: 'Még kevés az ízlés-tény (írj véleményeket!)' }, { status: 400 })
  try {
    await consumeAiQuota(userId, 'taste-eras')
    const eras = parseEras(await glmChat(buildErasMessages(
      facts.map((f) => ({ text: f.text, at: f.createdAt.toISOString() })),
    ), { userId, endpoint: 'taste-eras' }))
    await db.delete(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, 'taste-eras')))
    await db.insert(recommendations).values({ userId, kind: 'taste-eras', input: { factCount: facts.length }, result: { eras } })
    return NextResponse.json({ eras })
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
