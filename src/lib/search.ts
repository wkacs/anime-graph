import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

// Blend text relevance with popularity: among similar text matches the more
// popular title wins, but a strong text match still beats a weak one on a
// popular title. Log-damped so blockbusters don't drown out exact matches.
export function rankBlend(textRank: number, popularity: number): number {
  return textRank + Math.log10(Math.max(0, popularity) + 1) * 0.05
}

export type TitleHit = {
  titleId: number
  anilistId: number
  mediaType: string
  slug: string
  titleRomaji: string
  titleEnglish: string | null
  coverUrl: string | null
  year: number | null
  format: string | null
  communityScore: number | null
  popularity: number
}

export async function searchTitles(
  q: string,
  opts: { mediaType?: 'ANIME' | 'MANGA'; limit?: number; offset?: number } = {},
): Promise<TitleHit[]> {
  const query = q.trim()
  if (!query) return []
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  const offset = Math.max(0, opts.offset ?? 0)
  const typeFilter = opts.mediaType ? sql`AND media_type = ${opts.mediaType}` : sql``
  // rank blend mirrors rankBlend(): ts_rank_cd + log10(popularity+1)*0.05
  const result = await db.execute(sql`
    SELECT id AS "titleId", anilist_id AS "anilistId", media_type AS "mediaType",
      slug, title_romaji AS "titleRomaji", title_english AS "titleEnglish",
      cover_url AS "coverUrl", year, format,
      community_score AS "communityScore", popularity
    FROM title, websearch_to_tsquery('simple', ${query}) AS q
    WHERE search_vector @@ q AND is_adult = 0 ${typeFilter}
    ORDER BY ts_rank_cd(search_vector, q) + log(popularity + 1) * 0.05 DESC,
      popularity DESC
    LIMIT ${limit} OFFSET ${offset}`)
  // neon-http db.execute may return the rows array directly or a { rows } wrapper
  // depending on the driver version — normalise both.
  const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  return rows as TitleHit[]
}
