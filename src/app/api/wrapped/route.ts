import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, episodeLog, favoriteCharacters } from '@/db/schema'
import { availableYears, buildWrapped } from '@/lib/wrapped'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [rows, eps, favs] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(episodeLog).where(eq(episodeLog.userId, userId)),
    db.select().from(favoriteCharacters).where(eq(favoriteCharacters.userId, userId)),
  ])
  const mapped = rows.map((r) => ({
    id: r.id, titleRomaji: r.titleRomaji, coverUrl: r.coverUrl, genres: r.genres,
    studio: r.studio, myScore: r.myScore, mediaType: r.mediaType,
    durationMin: r.durationMin, chapters: r.chapters, progress: r.progress,
    watchedAt: r.watchedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
  }))
  const episodes = eps.map((e) => ({ animeId: e.animeId, watchedAt: e.watchedAt.toISOString() }))
  const years = availableYears(mapped, episodes)
  const year = Number(req.nextUrl.searchParams.get('year')) || years[0] || new Date().getFullYear()
  const data = buildWrapped(mapped, episodes,
    favs.map((f) => ({ name: f.name, image: f.image, createdAt: f.createdAt.toISOString() })), year)
  return NextResponse.json({ ...data, years })
}
