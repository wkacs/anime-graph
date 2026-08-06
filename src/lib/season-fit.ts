import { buildTasteVector, computeFit, fitTier, type FitTier, type TasteItem } from './fit-score'
import type { ScanEntry } from './taste-scan'

// Szezon-fit: „ez a szezon a TE izlesed szerint". Ugyanaz a fit-matek, amit a
// katalogus-oldal hasznal, csak egy szezon egesz kinalatara futtatva.
//
// Miert sajat fajl: ez az egyetlen hely, ahol a nem-bejelentkezett scan-listabol
// kell fit-vektort kepezni. A `TasteItem` alak a bejelentkezett listasorra van
// szabva, a `ScanEntry` az AniList publikus valaszara — a kettot itt kotjuk ossze,
// hogy a szamitas mindket oldalon ugyanaz maradjon.

export type SeasonCandidate = {
  anilistId: number
  slug: string
  titleRomaji: string
  titleEnglish: string | null
  coverUrl: string | null
  genres: string[]
  tags: { name: string; rank: number }[]
}

export type SeasonPick = SeasonCandidate & { score: number; tier: FitTier }

/** AniList-statusz → a fit-vektor statusz-szokincse. */
const STATUS_MAP: Record<string, string> = {
  COMPLETED: 'completed', CURRENT: 'watching', REPEATING: 'watching',
  PLANNING: 'planned', PAUSED: 'planned', DROPPED: 'dropped',
}

export function toTasteItems(entries: ScanEntry[]): TasteItem[] {
  return entries.map((e) => ({
    genres: e.genres,
    tags: e.tags,
    status: STATUS_MAP[e.status] ?? 'completed',
    // az AniList-nel a 0 „nincs pont", nem nulla ertekeles
    myScore: e.score != null && e.score > 0 ? e.score : null,
  }))
}

/**
 * A szezon cimei a nezo izlese szerint rangsorolva. Amire nincs eleg fedezet
 * (computeFit null), az kimarad — a szezon-lista nem hely a vaktippekre.
 */
export function rankSeason(
  entries: ScanEntry[],
  candidates: SeasonCandidate[],
  limit: number,
): SeasonPick[] {
  const vector = buildTasteVector(toTasteItems(entries))
  const owned = new Set(entries.map((e) => e.anilistId))
  return candidates
    // ami mar a listadon van, arrol nincs mit mondani ebben a nezetben
    .filter((c) => !owned.has(c.anilistId))
    .map((c) => {
      const fit = computeFit(vector, { genres: c.genres, tags: c.tags ?? [] })
      return fit ? { ...c, score: fit.score, tier: fitTier(fit.score) } : null
    })
    .filter((x): x is SeasonPick => x !== null)
    .sort((a, b) => b.score - a.score || a.anilistId - b.anilistId)
    .slice(0, limit)
}
