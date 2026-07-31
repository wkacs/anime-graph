import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, episodeLog, favoriteCharacters, opinions, settings, title, users } from '@/db/schema'
import { buildFeed } from '@/lib/feed'
import { requireUserId } from '@/lib/session'
import { canViewProfile } from '@/lib/profile-visibility'
import { and, desc, eq, inArray } from 'drizzle-orm'

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
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(eq(title.isAdult, 0))
      .orderBy(desc(anime.createdAt)).limit(60),
    db.select({
      userId: anime.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      at: opinions.updatedAt,
    }).from(opinions).innerJoin(anime, eq(anime.id, opinions.animeId))
      .innerJoin(users, eq(users.id, anime.userId))
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(eq(title.isAdult, 0))
      .orderBy(desc(opinions.updatedAt)).limit(60),
    db.select({
      userId: episodeLog.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      episode: episodeLog.episode, at: episodeLog.watchedAt,
    }).from(episodeLog).innerJoin(anime, eq(anime.id, episodeLog.animeId))
      .innerJoin(users, eq(users.id, episodeLog.userId))
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(eq(title.isAdult, 0))
      .orderBy(desc(episodeLog.watchedAt)).limit(200),
    db.select({
      userId: favoriteCharacters.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      charName: favoriteCharacters.name, at: favoriteCharacters.createdAt,
    }).from(favoriteCharacters).innerJoin(anime, eq(anime.id, favoriteCharacters.animeId))
      .innerJoin(users, eq(users.id, favoriteCharacters.userId))
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(eq(title.isAdult, 0))
      .orderBy(desc(favoriteCharacters.createdAt)).limit(60),
  ])

  const ownerIds = [...new Set([...added, ...ops, ...eps, ...favs].map((row) => row.userId))]
  const visibilityRows = ownerIds.length
    ? await db.select({ userId: settings.userId, value: settings.value }).from(settings)
      .where(and(
        inArray(settings.userId, ownerIds),
        eq(settings.key, 'profileVisibility'),
      ))
    : []
  const visibilityByUser = new Map(visibilityRows.map((row) => [row.userId, row.value]))
  const visible = <T extends { userId: number }>(rows: T[]) =>
    rows.filter((row) => canViewProfile(userId, row.userId, visibilityByUser.get(row.userId)))

  const iso = (d: Date) => d.toISOString()
  const items = buildFeed({
    added: visible(added).map((r) => ({ ...r, at: iso(r.at) })),
    opinions: visible(ops).map((r) => ({ ...r, at: iso(r.at) })),
    episodes: visible(eps).map((r) => ({ ...r, at: iso(r.at) })),
    favChars: visible(favs).map((r) => ({ ...r, at: iso(r.at) })),
  }, userId)
  return NextResponse.json({ items })
}
