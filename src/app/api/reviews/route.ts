import { NextResponse } from 'next/server'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, opinions, settings, title, users } from '@/db/schema'
import { canViewProfile } from '@/lib/profile-visibility'

export const dynamic = 'force-dynamic'

// Nyilvános értékelés-feed. A nyers véleményszöveg szándékosan nem része a
// selectnek/válasznak; csak explicit public profil pontszáma jelenhet meg.
export async function GET() {
  const rows = await db.select({
    id: opinions.id,
    updatedAt: opinions.updatedAt,
    username: users.username,
    userId: users.id,
    titleRomaji: anime.titleRomaji,
    coverUrl: anime.coverUrl,
    mediaType: anime.mediaType,
    score: anime.myScore,
    slug: title.slug,
  }).from(opinions)
    .innerJoin(anime, eq(opinions.animeId, anime.id))
    .innerJoin(users, eq(anime.userId, users.id))
    .innerJoin(title, eq(anime.titleId, title.id))
    .where(and(eq(title.isAdult, 0), isNotNull(anime.myScore)))
    .orderBy(desc(opinions.updatedAt))
    .limit(200)

  const userIds = [...new Set(rows.map((row) => row.userId))]
  const privacy = userIds.length
    ? await db.select({ userId: settings.userId, value: settings.value }).from(settings)
      .where(and(
        inArray(settings.userId, userIds),
        eq(settings.key, 'profileVisibility'),
      ))
    : []
  const visibilityByUser = new Map(privacy.map((row) => [row.userId, row.value]))

  return NextResponse.json({
    items: rows
      .filter((row) => canViewProfile(null, row.userId, visibilityByUser.get(row.userId)))
      .slice(0, 30)
      .map((row) => ({
        id: row.id,
        score: row.score,
        updatedAt: row.updatedAt,
        username: row.username,
        title: row.titleRomaji,
        coverUrl: row.coverUrl,
        href: `/${row.mediaType === 'MANGA' ? 'manga' : 'anime'}/${row.slug}`,
      })),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
