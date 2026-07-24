import { and, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm'
import { title } from '@/db/schema'
import { currentSeason, SEASON_ORDER } from './seasonal'

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

// az idei évből eddig ELKEZDŐDÖTT szezonok — a be nem mutatott címek hype-100%-a
// nélkül az AniList-fül használhatatlan lenne
export function airedSeasons(now: Date): string[] {
  const cur = currentSeason(now)
  return SEASON_ORDER.slice(0, SEASON_ORDER.indexOf(cur.season) + 1)
}

export function leaderboardQuery(
  tab: LeaderboardTab,
  mediaType: 'ANIME' | 'MANGA',
  genre?: string,
  now: Date = new Date(),
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
  // csak már bemutatott cím (év < idei, vagy idei és a szezonja elkezdődött)
  const { year } = currentSeason(now)
  const aired = airedSeasons(now).map((s) => `'${s}'`).join(',')
  parts.push(isNotNull(title.year))
  parts.push(sql`(${title.year} < ${year} OR (${title.year} = ${year} AND coalesce(${title.season}, 'WINTER') IN (${sql.raw(aired)})))`)
  return { where: and(...parts)!, order: desc(title.avgScore) }
}
