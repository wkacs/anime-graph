// Klub-ajánló (D5): N tag ízlés-vektorának metszete — „mit nézzen a csoport".
// Lokális, AI nélkül: minden jelöltre tagonkénti fit-score, csoport-pontszám =
// átlag és minimum keveréke (a minimum súlyozása védi a leggyengébb láncszemet),
// kemény vétó: akinek kifejezetten nem jönne be (fit < VETO_FIT), az kiüti a címet.

import { computeFit, type FitTarget, type TasteVector } from './fit-score'

export const VETO_FIT = 35
const MIN_KNOWN_MEMBERS = 2

export type GroupPickCandidate<T> = T & FitTarget

export type GroupPick<T> = {
  candidate: T
  groupScore: number
  perMember: (number | null)[]
}

export function rankGroupPicks<T>(
  vectors: TasteVector[],
  candidates: GroupPickCandidate<T>[],
  limit = 12,
): GroupPick<T>[] {
  const picks: GroupPick<T>[] = []
  for (const cand of candidates) {
    const fits = vectors.map((v) => computeFit(v, cand)?.score ?? null)
    const known = fits.filter((f): f is number => f != null)
    if (known.length < Math.min(MIN_KNOWN_MEMBERS, vectors.length)) continue
    if (known.some((f) => f < VETO_FIT)) continue
    const mean = known.reduce((a, b) => a + b, 0) / known.length
    const min = Math.min(...known)
    picks.push({ candidate: cand, groupScore: Math.round(mean * 0.6 + min * 0.4), perMember: fits })
  }
  return picks.sort((a, b) => b.groupScore - a.groupScore).slice(0, limit)
}
