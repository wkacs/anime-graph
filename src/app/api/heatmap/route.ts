import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { episodeLog } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(episodeLog).where(eq(episodeLog.userId, userId))
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
