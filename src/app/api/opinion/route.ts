import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, recommendations, tasteMemory } from '@/db/schema'
import { extractFacts } from '@/lib/extract'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const animeId = Number(req.nextUrl.searchParams.get('animeId'))
  if (!animeId) return NextResponse.json({ opinion: null })
  const [animeRow] = await db.select().from(anime)
    .where(and(eq(anime.id, animeId), eq(anime.userId, userId)))
  if (!animeRow) return NextResponse.json({ opinion: null })
  const [row] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
  return NextResponse.json({ opinion: row ?? null })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const animeId = Number(body?.animeId)
  if (!animeId) return NextResponse.json({ error: 'animeId kötelező' }, { status: 400 })

  const [animeRow] = await db.select().from(anime)
    .where(and(eq(anime.id, animeId), eq(anime.userId, userId)))
  if (!animeRow) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })

  let rawText: string
  if (body.retry === true) {
    const [existing] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
    if (!existing) return NextResponse.json({ error: 'Nincs mentett vélemény' }, { status: 404 })
    rawText = existing.rawText
  } else {
    rawText = String(body.rawText ?? '').trim()
    if (!rawText) return NextResponse.json({ error: 'Üres vélemény' }, { status: 400 })
    await db.insert(opinions)
      .values({ animeId, rawText, extractStatus: 'pending', updatedAt: new Date() })
      .onConflictDoUpdate({
        target: opinions.animeId,
        set: { rawText, extractStatus: 'pending', updatedAt: new Date() },
      })
  }

  try {
    await consumeAiQuota(userId, 'opinion')
    const facts = await extractFacts(animeRow.titleRomaji, rawText, { userId, endpoint: 'opinion' })
    await db.delete(tasteMemory).where(
      and(eq(tasteMemory.animeId, animeId), eq(tasteMemory.source, 'opinion')),
    )
    const inserted = await db.insert(tasteMemory).values(
      facts.map((f) => ({ userId, animeId, kind: f.kind, text: f.text, source: 'opinion' })),
    ).returning()
    await db.update(opinions).set({ extractStatus: 'done' }).where(eq(opinions.animeId, animeId))
    // új ízlés-tények → a korszak-cache elavult
    await db.delete(recommendations).where(
      and(eq(recommendations.userId, userId), eq(recommendations.kind, 'taste-eras')),
    )
    return NextResponse.json({ extractStatus: 'done', facts: inserted })
  } catch (e) {
    await db.update(opinions).set({ extractStatus: 'failed' }).where(eq(opinions.animeId, animeId))
    return NextResponse.json({ extractStatus: 'failed', error: String(e), facts: [] })
  }
}
