import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { eq } from 'drizzle-orm'

const STATUSES = ['watching', 'completed', 'dropped', 'planned'] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Érvénytelen státusz' }, { status: 400 })
    }
    patch.status = body.status
    if (body.status === 'completed' && body.watchedAt === undefined) {
      patch.watchedAt = new Date()
    }
  }
  if (body.progress !== undefined) patch.progress = Math.max(0, Number(body.progress) || 0)
  if (body.myScore !== undefined) {
    patch.myScore = body.myScore === null ? null
      : Math.min(10, Math.max(1, Number(body.myScore) || 1))
  }
  if (body.watchedAt !== undefined) {
    patch.watchedAt = body.watchedAt === null ? null : new Date(body.watchedAt)
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Üres módosítás' }, { status: 400 })
  }
  const [row] = await db.update(anime).set(patch).where(eq(anime.id, Number(id))).returning()
  if (!row) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })
  return NextResponse.json({ anime: row })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.delete(anime).where(eq(anime.id, Number(id)))
  return NextResponse.json({ ok: true })
}
