import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, favoriteCharacters, settings, title, users } from '@/db/schema'
import { toPublicAnime, toPublicPinned } from '@/lib/public-view'
import { and, eq, inArray } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// jelszó nélküli, csak-olvasható nézet — vélemények és ízlés-memória SOSEM megy ki
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  // a token bármelyik userhez tartozhat → kulcs szerint keresünk, érték szerint szűrünk
  const tokenRows = await db.select().from(settings).where(eq(settings.key, 'publicToken'))
  const match = tokenRows.find((r) => r.value === token)
  if (!match) {
    return apiError('invalidRevokedLink', 404)
  }

  const [owner] = await db.select().from(users).where(eq(users.id, match.userId))
  const rows = await db.select({
    titleRomaji: anime.titleRomaji, coverUrl: anime.coverUrl, status: anime.status,
    myScore: anime.myScore, year: anime.year, genres: anime.genres,
  }).from(anime)
    .innerJoin(title, eq(anime.titleId, title.id))
    .where(and(eq(anime.userId, match.userId), eq(title.isAdult, 0)))
  const genreCounts = new Map<string, number>()
  for (const a of rows) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)

  // kitűzött kedvencek — csak whitelist-mezőkkel (toPublicPinned a kapu)
  const readPins = async (key: string): Promise<number[]> => {
    const [row] = await db.select().from(settings)
      .where(and(eq(settings.userId, match.userId), eq(settings.key, key)))
    return Array.isArray(row?.value) ? (row.value as number[]).filter((n) => Number.isInteger(n)) : []
  }
  const [pinnedTitleIds, pinnedCharIds] = await Promise.all([readPins('pinnedTitles'), readPins('pinnedChars')])
  const [pinnedTitleRows, pinnedCharRows] = await Promise.all([
    pinnedTitleIds.length
      ? db.select({ id: title.id, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl, slug: title.slug, mediaType: title.mediaType })
          .from(title).where(and(inArray(title.id, pinnedTitleIds), eq(title.isAdult, 0)))
      : Promise.resolve([]),
    pinnedCharIds.length
      ? db.select({ charId: favoriteCharacters.charId, name: favoriteCharacters.name, image: favoriteCharacters.image })
          .from(favoriteCharacters)
          .where(and(eq(favoriteCharacters.userId, match.userId), inArray(favoriteCharacters.charId, pinnedCharIds)))
      : Promise.resolve([]),
  ])
  const byTitle = new Map(pinnedTitleRows.map((t) => [t.id, t]))
  const byChar = new Map(pinnedCharRows.map((c) => [c.charId, c]))
  const pinned = toPublicPinned(
    pinnedTitleIds.map((id) => byTitle.get(id)).filter((t): t is NonNullable<typeof t> => !!t),
    pinnedCharIds.map((id) => byChar.get(id)).filter((c): c is NonNullable<typeof c> => !!c),
  )

  return NextResponse.json({
    pinned,
    username: owner?.username ?? null,
    stats: {
      total: rows.length,
      completed: rows.filter((a) => a.status === 'completed').length,
      topGenres: [...genreCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    },
    anime: rows
      .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))
      .map(toPublicAnime),
  })
}
