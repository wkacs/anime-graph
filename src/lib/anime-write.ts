import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, title, userTitle } from '@/db/schema'
import { mapTitle, type TitleMetadata } from '@/lib/catalog'
import type { AnilistMedia } from '@/lib/anilist'

export type AnimeRow = typeof anime.$inferSelect

export async function ensureTitleByFields(meta: TitleMetadata): Promise<number> {
  const [row] = await db.insert(title).values(meta)
    .onConflictDoUpdate({
      target: [title.anilistId, title.mediaType],
      set: { syncedAt: sql`now()` }, // touch; full refresh is the sync worker's job
    })
    .returning({ id: title.id })
  return row.id
}

export function ensureTitle(m: AnilistMedia): Promise<number> {
  return ensureTitleByFields(mapTitle(m))
}

export async function joinedRow(userTitleId: number): Promise<AnimeRow> {
  const [row] = await db.select().from(anime).where(eq(anime.id, userTitleId))
  return row
}

export async function addUserTitle(
  userId: number, titleId: number,
  fields: { status: string; watchedAt: Date | null },
): Promise<AnimeRow> {
  const [ut] = await db.insert(userTitle)
    .values({ userId, titleId, status: fields.status, watchedAt: fields.watchedAt })
    .onConflictDoNothing({ target: [userTitle.userId, userTitle.titleId] })
    .returning({ id: userTitle.id })
  // onConflictDoNothing returns nothing if it already existed → fetch it
  const id = ut?.id ?? (await db.select({ id: userTitle.id }).from(userTitle)
    .where(and(eq(userTitle.userId, userId), eq(userTitle.titleId, titleId))))[0].id
  return joinedRow(id)
}

export async function updateUserTitle(
  userId: number, userTitleId: number, patch: Record<string, unknown>,
): Promise<AnimeRow | null> {
  const [ut] = await db.update(userTitle).set(patch)
    .where(and(eq(userTitle.id, userTitleId), eq(userTitle.userId, userId)))
    .returning({ id: userTitle.id })
  if (!ut) return null
  return joinedRow(ut.id)
}

export async function deleteUserTitle(userId: number, userTitleId: number): Promise<void> {
  await db.delete(userTitle)
    .where(and(eq(userTitle.id, userTitleId), eq(userTitle.userId, userId)))
}
