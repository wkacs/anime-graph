import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, animeStaff, tasteMemory, title, userTitle } from '@/db/schema'
import { fetchDirectors, fetchMedia } from '@/lib/anilist'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { ensureTitle, addUserTitle, updateUserTitle, joinedRow } from '@/lib/anime-write'
import { pushRowChange } from '@/lib/sync-back'

// DB-backed GET must not be statically executed at build time
export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  const facts = await db.select({
    id: tasteMemory.id,
    animeId: tasteMemory.animeId,
    kind: tasteMemory.kind,
    text: tasteMemory.text,
  }).from(tasteMemory).where(eq(tasteMemory.userId, userId))
  return NextResponse.json({ anime: rows, facts })
}

const ADD_STATUSES = ['watching', 'completed', 'dropped', 'planned'] as const

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)

  // catalog add: title already in our DB — no AniList round-trip
  const catalogTitleId = Number(body?.titleId)
  if (Number.isInteger(catalogTitleId) && catalogTitleId > 0) {
    const status = ADD_STATUSES.includes(body?.status) ? body.status as string : 'planned'
    const [catalogTitle] = await db.select({ isAdult: title.isAdult }).from(title)
      .where(eq(title.id, catalogTitleId))
    if (!catalogTitle || catalogTitle.isAdult) {
      return NextResponse.json({ error: 'Ez a cím nem érhető el' }, { status: 404 })
    }
    const existing = await db.select({ id: userTitle.id }).from(userTitle)
      .where(and(eq(userTitle.userId, userId), eq(userTitle.titleId, catalogTitleId)))
    if (existing.length) {
      const row = await joinedRow(existing[0].id)
      return NextResponse.json({ anime: row })
    }
    const row = await addUserTitle(userId, catalogTitleId, {
      status, watchedAt: status === 'completed' ? new Date() : null,
    })
    await pushRowChange(userId, row, { status })
    return NextResponse.json({ anime: row }, { status: 201 })
  }

  const anilistId = Number(body?.anilistId)
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'anilistId vagy titleId kötelező' }, { status: 400 })
  }
  const status = ADD_STATUSES.includes(body?.status) ? body.status as string : 'planned'
  const userFields = {
    status,
    watchedAt: status === 'completed' ? new Date() : null,
  }

  const existing = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.anilistId, anilistId)))
  if (existing.length) {
    // már fent van → csak a kért státuszt vesszük át
    if (body?.status && existing[0].status !== status) {
      const row = await updateUserTitle(userId, existing[0].id, {
        status, watchedAt: existing[0].watchedAt ?? userFields.watchedAt,
      })
      await pushRowChange(userId, existing[0], { status })
      return NextResponse.json({ anime: row })
    }
    return NextResponse.json({ anime: existing[0] })
  }
  const media = await fetchMedia(anilistId, true) // típus-szűrő nélkül: manga-id-ra is működik
  if (media.isAdult) return NextResponse.json({ error: 'Ez a cím nem érhető el' }, { status: 404 })
  const titleId = await ensureTitle(media)
  const row = await addUserTitle(userId, titleId, userFields)
  // rendező best-effort mentése — hibája nem akaszthatja meg az add-ot
  try {
    const directors = await fetchDirectors(anilistId)
    if (directors.length) {
      await db.insert(animeStaff)
        .values(directors.map((d) => ({ userId, animeId: row.id, staffId: d.staffId, name: d.name, image: d.image, role: d.role })))
        .onConflictDoNothing()
    }
  } catch { /* staff nélkül is él a sor */ }
  await pushRowChange(userId, row, { status })
  return NextResponse.json({ anime: row }, { status: 201 })
}
