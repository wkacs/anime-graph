import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
// dbStatic: az ISR-oldalak (katalógus-shell) alatt a no-store kliens 500-at dobna
import { dbStatic as db } from '@/db/client'
import { title, userTitle, type RelationEntry } from '@/db/schema'

export type TitleRow = typeof title.$inferSelect

// ANIME oldalon az eredeti mű (SOURCE), MANGA oldalon az adaptáció érdekes.
export function pickSourceRelation(
  relations: RelationEntry[],
  mediaType: 'ANIME' | 'MANGA',
): RelationEntry | null {
  const want = mediaType === 'ANIME' ? 'SOURCE' : 'ADAPTATION'
  return relations.find((r) => r.type === want) ?? null
}

// a kiemelt relation lokális megfelelője (borító + kanonikus link), ha megvan a katalógusban
export async function resolveRelationLocal(
  anilistId: number,
  mediaType: 'ANIME' | 'MANGA',
): Promise<{ slug: string; mediaType: string; coverUrl: string | null } | null> {
  const [row] = await db.select({ slug: title.slug, mediaType: title.mediaType, coverUrl: title.coverUrl })
    .from(title)
    .where(and(eq(title.anilistId, anilistId), eq(title.mediaType, mediaType), eq(title.isAdult, 0)))
  return row ?? null
}

/** Relation JSON-ben nincs mediaType; a kapcsolt címnél ezért bármely publikus katalógussort elfogadunk. */
export async function resolveAnyRelationLocal(
  anilistId: number,
): Promise<{ slug: string; mediaType: string; coverUrl: string | null } | null> {
  const [row] = await db.select({ slug: title.slug, mediaType: title.mediaType, coverUrl: title.coverUrl })
    .from(title)
    .where(and(eq(title.anilistId, anilistId), eq(title.isAdult, 0)))
  return row ?? null
}

export function canonicalPath(mediaType: string, slug: string): string {
  return `/${mediaType === 'MANGA' ? 'manga' : 'anime'}/${slug}`
}

// React cache(): a generateMetadata és az oldal-render egy kérésen belül
// ugyanazt a sort kapja, egyetlen DB-hívásból.
export const resolveTitleBySlug = cache(async (
  mediaType: 'ANIME' | 'MANGA', slug: string,
): Promise<TitleRow | null> => {
  const [row] = await db.select().from(title)
    .where(and(eq(title.mediaType, mediaType), eq(title.slug, slug)))
  return row ?? null
})

export async function legacyRedirectTarget(userTitleId: number): Promise<string | null> {
  const [row] = await db.select({ mediaType: title.mediaType, slug: title.slug })
    .from(userTitle).innerJoin(title, eq(userTitle.titleId, title.id))
    .where(eq(userTitle.id, userTitleId))
  return row ? canonicalPath(row.mediaType, row.slug) : null
}
