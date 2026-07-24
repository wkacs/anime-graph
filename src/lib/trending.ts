import { currentSeason } from './seasonal'

// A böngésző üres állapota: az aktuális szezon legjobbjai + nálunk népszerű címek.
export const TRENDING_LIMIT = 12

export function trendingSeasonParams(now: Date): { season: string; year: number } {
  return currentSeason(now)
}
