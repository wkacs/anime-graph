import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, watchlistItems } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { desc, eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [items, us] = await Promise.all([
    db.select().from(watchlistItems).orderBy(desc(watchlistItems.createdAt)),
    db.select({ id: users.id, username: users.username }).from(users),
  ])
  return NextResponse.json({ items, usernames: Object.fromEntries(us.map((u) => [u.id, u.username])) })
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
      anilistId, title,
      coverUrl: body?.coverUrl ?? null,
      mediaType: body?.mediaType === 'MANGA' ? 'MANGA' : 'ANIME',
      addedBy: userId,
    })
    .onConflictDoNothing({ target: watchlistItems.anilistId })
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
    .where(eq(watchlistItems.id, id))
    .returning()
  return NextResponse.json({ item: row ?? null })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const id = Number(body?.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id kötelező' }, { status: 400 })
  await db.delete(watchlistItems).where(eq(watchlistItems.id, id))
  return NextResponse.json({ ok: true })
}
