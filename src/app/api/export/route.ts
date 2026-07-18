import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory, settings, duels } from '@/db/schema'

export const dynamic = 'force-dynamic'

// full data export — the opinions are irreplaceable, everything else is convenience
export async function GET() {
  const [animeRows, opinionRows, tasteRows, settingRows, duelRows] = await Promise.all([
    db.select().from(anime),
    db.select().from(opinions),
    db.select().from(tasteMemory),
    db.select().from(settings),
    db.select().from(duels),
  ])
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
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
