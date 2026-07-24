import { and, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm'
import { title } from '@/db/schema'

// Toplista: harom rangsor-mod egy kozos query-builderrel.
// 'sajat'    = hazon beluli bayesian kozossegi pontszam (min. 2 ertekeles)
// 'anilist'  = AniList atlagpontszam a teljes katalogusra
// 'nepszeru' = hanyan vettek fel nalunk (popularity)
export type LeaderboardTab = 'sajat' | 'anilist' | 'nepszeru'

export const COMMUNITY_MIN_COUNT = 2
export const LEADERBOARD_LIMIT = 50

export function parseLeaderboardTab(raw: string | null): LeaderboardTab {
  return raw === 'sajat' || raw === 'nepszeru' ? raw : 'anilist'
}

export function leaderboardQuery(
  tab: LeaderboardTab,
  mediaType: 'ANIME' | 'MANGA',
  genre?: string,
): { where: SQL; order: SQL } {
  const parts: SQL[] = [eq(title.mediaType, mediaType)]
  if (genre) parts.push(sql`${genre} = ANY(${title.genres})`)
  if (tab === 'sajat') {
    parts.push(gte(title.communityCount, COMMUNITY_MIN_COUNT))
    return { where: and(...parts)!, order: desc(title.communityScore) }
  }
  if (tab === 'nepszeru') {
    parts.push(gte(title.popularity, 1))
    return { where: and(...parts)!, order: desc(title.popularity) }
  }
  parts.push(isNotNull(title.avgScore))
  return { where: and(...parts)!, order: desc(title.avgScore) }
}
