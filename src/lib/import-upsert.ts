import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { userTitle } from '@/db/schema'
import { ensureTitleByFields } from '@/lib/anime-write'
import type { TitleMetadata } from '@/lib/catalog'

export type ImportRow = {
  meta: TitleMetadata
  user: { status: string; myScore: number | null; progress: number; watchedAt: Date | null }
}

// per row: ensure the global title exists, then upsert the user_title.
// existing user rows keep watched_at when the incoming value is null.
export async function upsertImported(
  userId: number, rows: ImportRow[],
): Promise<{ added: number; updated: number }> {
  let added = 0, updated = 0
  for (const { meta, user } of rows) {
    const titleId = await ensureTitleByFields(meta)
    const existing = await db.select({ id: userTitle.id }).from(userTitle)
      .where(and(eq(userTitle.userId, userId), eq(userTitle.titleId, titleId)))
    if (existing.length) updated++; else added++
    await db.insert(userTitle)
      .values({ userId, titleId, status: user.status, myScore: user.myScore,
        progress: user.progress, watchedAt: user.watchedAt })
      .onConflictDoUpdate({
        target: [userTitle.userId, userTitle.titleId],
        set: {
          status: sql`excluded.status`,
          myScore: sql`excluded.my_score`,
          progress: sql`excluded.progress`,
          watchedAt: sql`coalesce(excluded.watched_at, ${userTitle.watchedAt})`,
        },
      })
  }
  return { added, updated }
}
