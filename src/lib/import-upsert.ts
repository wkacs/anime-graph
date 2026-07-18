import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, type AnimeInsert } from '@/db/schema'

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// batch upsert for importers: new rows get full metadata, existing rows only
// get their user-owned fields refreshed (watched_at never cleared by a null)
export async function upsertImported(rows: AnimeInsert[]): Promise<{ added: number; updated: number }> {
  if (!rows.length) return { added: 0, updated: 0 }
  const existing = new Set(
    (await db.select({ anilistId: anime.anilistId }).from(anime)).map((r) => r.anilistId),
  )
  let added = 0
  let updated = 0
  for (const row of rows) {
    if (existing.has(row.anilistId)) updated++
    else added++
  }
  for (const chunk of chunks(rows, 50)) {
    await db.insert(anime).values(chunk).onConflictDoUpdate({
      target: anime.anilistId,
      set: {
        status: sql`excluded.status`,
        myScore: sql`excluded.my_score`,
        progress: sql`excluded.progress`,
        watchedAt: sql`coalesce(excluded.watched_at, ${anime.watchedAt})`,
      },
    })
  }
  return { added, updated }
}
