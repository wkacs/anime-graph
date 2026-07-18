import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, settings, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// jelszó nélküli, csak-olvasható nézet — vélemények és ízlés-memória SOSEM megy ki
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  // a token bármelyik userhez tartozhat → kulcs szerint keresünk, érték szerint szűrünk
  const tokenRows = await db.select().from(settings).where(eq(settings.key, 'publicToken'))
  const match = tokenRows.find((r) => r.value === token)
  if (!match) {
    return NextResponse.json({ error: 'Érvénytelen vagy visszavont link' }, { status: 404 })
  }

  const [owner] = await db.select().from(users).where(eq(users.id, match.userId))
  const rows = await db.select().from(anime).where(eq(anime.userId, match.userId))
  const genreCounts = new Map<string, number>()
  for (const a of rows) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)

  return NextResponse.json({
    username: owner?.username ?? null,
    stats: {
      total: rows.length,
      completed: rows.filter((a) => a.status === 'completed').length,
      topGenres: [...genreCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
        .map(([name, count]) => ({ name, count })),
    },
    anime: rows
      .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))
      .map((a) => ({
        title: a.titleRomaji,
        coverUrl: a.coverUrl,
        status: a.status,
        myScore: a.myScore,
        year: a.year,
      })),
  })
}
