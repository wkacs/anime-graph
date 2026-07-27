import type { LeaderboardTab } from './leaderboard'

export type LeaderRow = {
  rank: number
  id: number
  slug: string
  mediaType: string
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  communityScore: number | null
  communityCount: number
  popularity: number
}

/**
 * A sorban a szam nagyban, a mertekegyseg kicsiben all.
 * A lib NYELVFUGGETLEN: nem szoveget ad vissza, hanem a mertekegyseg FAJTAJAT
 * es a szamot — a forditas a komponens dolga. Igy a toplista tobb nyelven is
 * ugyanezt a logikat hasznalja.
 */
export type Metric = {
  value: string
  unit: 'percent' | 'raters' | 'lists' | 'none'
  /** csak 'raters' eseten: hany pontozo */
  count?: number
}

const MISSING: Metric = { value: '-', unit: 'none' }

// U+202F = keskeny nem-toro szokoz. Escape-kent irva, mert a nyers karakter
// vizualisan megkulonboztethetetlen a sima szokoztol.
export const THIN_SPACE = ' '

// Ezres tagolas: a 4+ jegyu szamok kulonben osszefolynak, a sima szokoz
// viszont sortorest engedne a szamon belul.
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE)
}

export function formatMetric(row: LeaderRow, tab: LeaderboardTab): Metric {
  if (tab === 'nepszeru') {
    return { value: group(row.popularity), unit: 'lists' }
  }
  if (tab === 'sajat') {
    if (row.communityScore == null) return MISSING
    return { value: row.communityScore.toFixed(1), unit: 'raters', count: row.communityCount }
  }
  if (row.avgScore == null) return MISSING
  return { value: String(row.avgScore), unit: 'percent' }
}
