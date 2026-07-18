import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory, settings, duels } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// full data export — the opinions are irreplaceable, everything else is convenience
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const animeRows = await db.select().from(anime).where(eq(anime.userId, userId))
  const animeIds = animeRows.map((a) => a.id)
  const [opinionRows, tasteRows, settingRows, duelRows] = await Promise.all([
    animeIds.length
      ? db.select().from(opinions).where(inArray(opinions.animeId, animeIds))
      : Promise.resolve([]),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)),
    db.select().from(settings).where(eq(settings.userId, userId)),
    db.select().from(duels).where(eq(duels.userId, userId)),
  ])
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    anime: animeRows,
    opinions: opinionRows,
    tasteMemory: tasteRows,
    settings: settingRows,
    duels: duelRows,
  }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="anime-graph-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
