import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { getCached, setCached } from '@/lib/api-cache'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const followed = (await db.select().from(anime).where(eq(anime.userId, userId)))
    .filter((row) => row.mediaType === 'ANIME' && (row.status === 'watching' || row.status === 'planned'))
  const ids = [...new Set(followed.map((row) => row.anilistId))]
  if (!ids.length) return NextResponse.json({ items: [] })

  const key = `notifications:airing:${ids.sort((a, b) => a - b).join(',')}`
  let airing = await getCached<Awaited<ReturnType<typeof fetchAiringFor>>>(key)
  if (!airing) {
    airing = await fetchAiringFor(ids).catch(() => [])
    if (airing.length) await setCached(key, airing, 900)
  }
  const titleById = new Map(followed.map((row) => [row.anilistId, row]))
  const now = Math.floor(Date.now() / 1000)
  const items = airing
    .filter((entry) => entry.airingAt >= now - 6 * 3600 && entry.airingAt <= now + 14 * 86400)
    .map((entry) => {
      const row = titleById.get(entry.anilistId)!
      return {
        anilistId: entry.anilistId,
        title: row.titleRomaji,
        coverUrl: row.coverUrl,
        episode: entry.nextEpisode,
        airingAt: entry.airingAt,
        href: `/anime/preview/${entry.anilistId}`,
      }
    })
    .sort((a, b) => a.airingAt - b.airingAt)
  return NextResponse.json({ items })
}
