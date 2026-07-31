import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { sendDailyAiringEmail } from '@/lib/airing-email'
import { authorizeCron } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = authorizeCron(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (auth === 'misconfigured') return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  if (auth === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rows = await db.select().from(anime).where(eq(anime.mediaType, 'ANIME'))
  const followed = rows.filter((row) => row.status === 'watching' || row.status === 'planned')
  if (!followed.length) {
    return NextResponse.json({ status: 'skipped', reason: 'nincs követett anime' })
  }
  const airing = await fetchAiringFor([...new Set(followed.map((row) => row.anilistId))])
  const result = await sendDailyAiringEmail(followed, airing)
  return NextResponse.json(result, { status: result.status === 'failed' ? 502 : 200 })
}

