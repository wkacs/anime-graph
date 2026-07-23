import { and, eq } from 'drizzle-orm'
// dbStatic: az ISR-oldalak (katalógus-shell) alatt a no-store kliens 500-at dobna
import { dbStatic as db } from '@/db/client'
import { title, userTitle } from '@/db/schema'

export type TitleRow = typeof title.$inferSelect

export function canonicalPath(mediaType: string, slug: string): string {
  return `/${mediaType === 'MANGA' ? 'manga' : 'anime'}/${slug}`
}

export async function resolveTitleBySlug(
  mediaType: 'ANIME' | 'MANGA', slug: string,
): Promise<TitleRow | null> {
  const [row] = await db.select().from(title)
    .where(and(eq(title.mediaType, mediaType), eq(title.slug, slug)))
  return row ?? null
}

export async function legacyRedirectTarget(userTitleId: number): Promise<string | null> {
  const [row] = await db.select({ mediaType: title.mediaType, slug: title.slug })
    .from(userTitle).innerJoin(title, eq(userTitle.titleId, title.id))
    .where(eq(userTitle.id, userTitleId))
  return row ? canonicalPath(row.mediaType, row.slug) : null
}
