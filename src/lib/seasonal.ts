import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'
import type { RecCandidate } from './anilist'

export const SEASON_LABELS: Record<string, string> = {
  WINTER: 'Tél',
  SPRING: 'Tavasz',
  SUMMER: 'Nyár',
  FALL: 'Ősz',
}

export function currentSeason(now: Date): { season: string; year: number } {
  const m = now.getMonth() + 1
  const season = m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'FALL'
  return { season, year: now.getFullYear() }
}

const SEASON_ORDER = ['WINTER', 'SPRING', 'SUMMER', 'FALL']

export function nextSeason(now: Date): { season: string; year: number } {
  const cur = currentSeason(now)
  const i = SEASON_ORDER.indexOf(cur.season)
  return i === SEASON_ORDER.length - 1
    ? { season: SEASON_ORDER[0], year: cur.year + 1 }
    : { season: SEASON_ORDER[i + 1], year: cur.year }
}

export const seasonScoresSchema = z.object({
  scores: z.array(z.object({
    anilistId: z.number().int(),
    score: z.number().int().min(0).max(100),
    reason: z.string().min(5).max(200),
  })).min(1).max(30),
})

export type SeasonScore = z.infer<typeof seasonScoresSchema>['scores'][number]

const SYSTEM = `Anime-tanácsadó vagy. A felhasználó ízlés-memóriája alapján 0-100 skálán
pontozod, mennyire való NEKI az adott szezonos anime, és egy rövid magyar mondatban
megindokolod. A pontszám az Ő ízlésére passzolást méri, nem az anime általános minőségét.
Válaszolj KIZÁRÓLAG JSON-nal: {"scores":[{"anilistId":szám,"score":0-100,"reason":"…"}]}
Minden jelöltet pontozz, csak a megadott anilistId-ket használhatod.`

export function buildSeasonMessages(
  candidates: RecCandidate[],
  tasteFacts: string[],
): ChatMessage[] {
  const candLines = candidates.map((c) =>
    `[${c.anilistId}] ${c.title} — műfaj: ${c.genres.join(', ')}; AniList-átlag: ${c.avgScore ?? '?'}`,
  ).join('\n')
  const factLines = tasteFacts.length ? tasteFacts.map((f) => `- ${f}`).join('\n') : '- (üres)'
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Ízlés-memóriám:\n${factLines}\n\nSzezonos jelöltek:\n${candLines}` },
  ]
}

export function parseSeasonScores(raw: string): SeasonScore[] {
  return seasonScoresSchema.parse(extractJson(raw)).scores
}
