import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { episodeLog } from '@/db/schema'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await db.select().from(episodeLog)
  const counts = new Map<string, number>()
  for (const r of rows) {
    // budapesti nap szerint csoportosítunk
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' })
      .format(new Date(r.watchedAt))
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return NextResponse.json({
    entries: [...counts.entries()].map(([date, count]) => ({ date, count })),
  })
}
