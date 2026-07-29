import { NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, opinions, settings, title, users } from '@/db/schema'

export const dynamic = 'force-dynamic'

// Nyilvános vélemény-feed. A profil privacy az egyetlen közzétételi kapcsoló:
// private felhasználó sorai itt és a publikus profilján sem jelenhetnek meg.
export async function GET() {
  const rows = await db.select({
    id: opinions.id,
    rawText: opinions.rawText,
    updatedAt: opinions.updatedAt,
    username: users.username,
    userId: users.id,
    titleRomaji: anime.titleRomaji,
    coverUrl: anime.coverUrl,
    mediaType: anime.mediaType,
    slug: title.slug,
  }).from(opinions)
    .innerJoin(anime, eq(opinions.animeId, anime.id))
    .innerJoin(users, eq(anime.userId, users.id))
    .innerJoin(title, eq(anime.titleId, title.id))
    .orderBy(desc(opinions.updatedAt))
    .limit(100)

  const userIds = [...new Set(rows.map((row) => row.userId))]
  const privacy = userIds.length
    ? await db.select({ userId: settings.userId, value: settings.value }).from(settings)
      .where(inArray(settings.userId, userIds))
    : []
  const privateUsers = new Set(
    privacy.filter((row) => row.value === 'private').map((row) => row.userId),
  )

  return NextResponse.json({
    items: rows
      .filter((row) => !privateUsers.has(row.userId))
      .slice(0, 30)
      .map((row) => ({
        id: row.id,
        text: row.rawText,
        updatedAt: row.updatedAt,
        username: row.username,
        title: row.titleRomaji,
        coverUrl: row.coverUrl,
        href: `/${row.mediaType === 'MANGA' ? 'manga' : 'anime'}/${row.slug}`,
      })),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
