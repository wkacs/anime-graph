import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { favoriteCharacters } from '@/db/schema'
import { fetchCharacters } from '@/lib/anilist'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ anilistId: string }> }) {
  const userId = await requireUserId()
  const { anilistId: raw } = await params
  const anilistId = Number(raw)
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'érvénytelen id' }, { status: 400 })
  }
  try {
    const [characters, favs] = await Promise.all([
      fetchCharacters(anilistId),
      userId
        ? db.select({ charId: favoriteCharacters.charId }).from(favoriteCharacters)
          .where(eq(favoriteCharacters.userId, userId))
        : Promise.resolve([]),
    ])
    return NextResponse.json({ characters, favoriteIds: favs.map((f) => f.charId) })
  } catch (e) {
    return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
  }
}
