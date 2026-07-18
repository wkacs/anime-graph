import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, episodeLog, opinions, tasteMemory } from '@/db/schema'
import { eq } from 'drizzle-orm'

const STATUSES = ['watching', 'completed', 'dropped', 'planned'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const animeId = Number(id)
  const [row] = await db.select().from(anime).where(eq(anime.id, animeId))
  if (!row) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })
  const [opinion] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
  const facts = await db.select({
    id: tasteMemory.id,
    animeId: tasteMemory.animeId,
    kind: tasteMemory.kind,
    text: tasteMemory.text,
  }).from(tasteMemory).where(eq(tasteMemory.animeId, animeId))
  return NextResponse.json({ anime: row, opinion: opinion ?? null, facts })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const animeId = Number(id)
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  // újranézés: számláló nő, progressz nullázódik, megy a "nézem"-be
  if (body.rewatch === true) {
    const [current] = await db.select().from(anime).where(eq(anime.id, animeId))
    if (!current) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })
    const [row] = await db.update(anime)
      .set({ rewatchCount: current.rewatchCount + 1, progress: 0, status: 'watching' })
      .where(eq(anime.id, animeId))
      .returning()
    return NextResponse.json({ anime: row })
  }

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

  // progressz-növekedés → epizód-napló a heatmaphez (max 30 sor/módosítás)
  if (patch.progress !== undefined) {
    const [before] = await db.select({ progress: anime.progress }).from(anime).where(eq(anime.id, animeId))
    if (before && (patch.progress as number) > before.progress) {
      const from = before.progress + 1
      const to = Math.min(patch.progress as number, before.progress + 30)
      const logs = []
      for (let ep = from; ep <= to; ep++) logs.push({ animeId, episode: ep })
      if (logs.length) await db.insert(episodeLog).values(logs)
    }
  }

  const [row] = await db.update(anime).set(patch).where(eq(anime.id, animeId)).returning()
  if (!row) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })
  return NextResponse.json({ anime: row })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const animeId = Number(id)
  // return the full bundle so the client can offer an undo
  const [row] = await db.select().from(anime).where(eq(anime.id, animeId))
  if (!row) return NextResponse.json({ ok: true, bundle: null })
  const [opinion] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
  const facts = await db.select().from(tasteMemory).where(eq(tasteMemory.animeId, animeId))
  await db.delete(anime).where(eq(anime.id, animeId))
  return NextResponse.json({ ok: true, bundle: { anime: row, opinion: opinion ?? null, facts } })
}
