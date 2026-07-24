import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { favoriteCharacters, settings, title, userTitle } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { PinError, validatePins } from '@/lib/pins'

export const dynamic = 'force-dynamic'

async function readPinIds(userId: number, key: 'pinnedTitles' | 'pinnedChars'): Promise<number[]> {
  const [row] = await db.select().from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
  return Array.isArray(row?.value) ? (row.value as number[]).filter((n) => Number.isInteger(n)) : []
}

async function upsertPins(userId: number, key: string, value: number[]) {
  await db.insert(settings)
    .values({ userId, key, value })
    .onConflictDoUpdate({ target: [settings.userId, settings.key], set: { value } })
}

// GET: a kitűzött címek/karakterek megjelenítendő mezőkkel, a mentett sorrendben
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [titleIds, charIds] = await Promise.all([
    readPinIds(userId, 'pinnedTitles'),
    readPinIds(userId, 'pinnedChars'),
  ])
  const [titleRows, charRows] = await Promise.all([
    titleIds.length
      ? db.select({
          titleId: title.id, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
          slug: title.slug, mediaType: title.mediaType,
        }).from(title).where(inArray(title.id, titleIds))
      : Promise.resolve([]),
    charIds.length
      ? db.select({ charId: favoriteCharacters.charId, name: favoriteCharacters.name, image: favoriteCharacters.image })
          .from(favoriteCharacters)
          .where(and(eq(favoriteCharacters.userId, userId), inArray(favoriteCharacters.charId, charIds)))
      : Promise.resolve([]),
  ])
  const byTitle = new Map(titleRows.map((t) => [t.titleId, t]))
  const byChar = new Map(charRows.map((c) => [c.charId, c]))
  return NextResponse.json({
    titles: titleIds.map((id) => byTitle.get(id)).filter(Boolean),
    chars: charIds.map((id) => byChar.get(id)).filter(Boolean),
  })
}

// PUT: { titles?: number[]; chars?: number[] } — csak saját elem, max 3-3
export async function PUT(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  try {
    if (body.titles !== undefined) {
      const owned = await db.select({ titleId: userTitle.titleId }).from(userTitle)
        .where(eq(userTitle.userId, userId))
      const valid = validatePins(body.titles, new Set(owned.map((o) => o.titleId)))
      await upsertPins(userId, 'pinnedTitles', valid)
    }
    if (body.chars !== undefined) {
      const favs = await db.select({ charId: favoriteCharacters.charId }).from(favoriteCharacters)
        .where(eq(favoriteCharacters.userId, userId))
      const valid = validatePins(body.chars, new Set(favs.map((f) => f.charId)))
      await upsertPins(userId, 'pinnedChars', valid)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof PinError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }
}
