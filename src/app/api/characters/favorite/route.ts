import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, favoriteCharacters } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const charId = Number(body?.charId)
  const animeId = Number(body?.animeId)
  const name = String(body?.name ?? '').trim()
  if (!Number.isInteger(charId) || charId <= 0 || !Number.isInteger(animeId) || !name) {
    return apiError('charFavRequired', 400)
  }
  // ownership: a hivatkozott anime a sajátja legyen
  const [owned] = await db.select({ id: anime.id }).from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.id, animeId)))
  if (!owned) return apiError('noSuchAnimeInList', 404)

  await db.insert(favoriteCharacters).values({
    userId,
    charId,
    name,
    image: body?.image ? String(body.image) : null,
    vaId: Number.isInteger(Number(body?.vaId)) && Number(body?.vaId) > 0 ? Number(body.vaId) : null,
    vaName: body?.vaName ? String(body.vaName) : null,
    vaImage: body?.vaImage ? String(body.vaImage) : null,
    animeId,
  }).onConflictDoNothing()
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const charId = Number(body?.charId)
  if (!Number.isInteger(charId) || charId <= 0) {
    return apiError('charIdRequired', 400)
  }
  await db.delete(favoriteCharacters)
    .where(and(eq(favoriteCharacters.userId, userId), eq(favoriteCharacters.charId, charId)))
  return NextResponse.json({ ok: true })
}
