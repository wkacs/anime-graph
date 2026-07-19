import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, episodeLog, favoriteCharacters, opinions, users } from '@/db/schema'
import { buildFeed } from '@/lib/feed'
import { requireUserId } from '@/lib/session'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [added, ops, eps, favs] = await Promise.all([
    db.select({
      userId: anime.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      status: anime.status, at: anime.createdAt,
    }).from(anime).innerJoin(users, eq(users.id, anime.userId))
      .orderBy(desc(anime.createdAt)).limit(60),
    db.select({
      userId: anime.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      text: opinions.rawText, at: opinions.updatedAt,
    }).from(opinions).innerJoin(anime, eq(anime.id, opinions.animeId))
      .innerJoin(users, eq(users.id, anime.userId))
      .orderBy(desc(opinions.updatedAt)).limit(60),
    db.select({
      userId: episodeLog.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      episode: episodeLog.episode, at: episodeLog.watchedAt,
    }).from(episodeLog).innerJoin(anime, eq(anime.id, episodeLog.animeId))
      .innerJoin(users, eq(users.id, episodeLog.userId))
      .orderBy(desc(episodeLog.watchedAt)).limit(200),
    db.select({
      userId: favoriteCharacters.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      charName: favoriteCharacters.name, at: favoriteCharacters.createdAt,
    }).from(favoriteCharacters).innerJoin(anime, eq(anime.id, favoriteCharacters.animeId))
      .innerJoin(users, eq(users.id, favoriteCharacters.userId))
      .orderBy(desc(favoriteCharacters.createdAt)).limit(60),
  ])

  const iso = (d: Date) => d.toISOString()
  const items = buildFeed({
    added: added.map((r) => ({ ...r, at: iso(r.at) })),
    opinions: ops.map((r) => ({ ...r, at: iso(r.at) })),
    episodes: eps.map((r) => ({ ...r, at: iso(r.at) })),
    favChars: favs.map((r) => ({ ...r, at: iso(r.at) })),
  }, userId)
  return NextResponse.json({ items })
}
