import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { watchlistItems } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, desc, eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const items = await db.select().from(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.createdAt))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const anilistId = Number(body?.anilistId)
  const title = String(body?.title ?? '').trim()
  if (!Number.isInteger(anilistId) || anilistId <= 0 || !title) {
    return NextResponse.json({ error: 'anilistId és title kötelező' }, { status: 400 })
  }
  const [row] = await db.insert(watchlistItems)
    .values({
      userId,
      anilistId, title,
      coverUrl: body?.coverUrl ?? null,
      mediaType: body?.mediaType === 'MANGA' ? 'MANGA' : 'ANIME',
    })
    .onConflictDoNothing({ target: [watchlistItems.userId, watchlistItems.anilistId] })
    .returning()
  return NextResponse.json({ item: row ?? null }, { status: row ? 201 : 200 })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const id = Number(body?.id)
  const delta = Number(body?.delta)
  if (!Number.isInteger(id) || ![1, -1].includes(delta)) {
    return NextResponse.json({ error: 'id és delta (±1) kötelező' }, { status: 400 })
  }
  const [row] = await db.update(watchlistItems)
    .set({ watchedEpisodes: sql`greatest(${watchlistItems.watchedEpisodes} + ${delta}, 0)` })
    .where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, userId)))
    .returning()
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ item: row ?? null })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const id = Number(body?.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id kötelező' }, { status: 400 })
  const [deleted] = await db.delete(watchlistItems)
    .where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, userId)))
    .returning({ id: watchlistItems.id })
  if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
