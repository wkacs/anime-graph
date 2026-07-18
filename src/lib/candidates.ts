import type { RecCandidate } from './anilist'

export function genreWeights(
  rows: { genres: string[]; myScore: number | null; elo: number }[],
): Map<string, number> {
  const w = new Map<string, number>()
  for (const r of rows) {
    const scorePart = r.myScore != null ? r.myScore - 5 : 0
    const eloPart = (r.elo - 1200) / 400
    for (const g of r.genres) {
      w.set(g, (w.get(g) ?? 0) + scorePart + eloPart)
    }
  }
  return w
}

export function rankCandidates(
  cands: RecCandidate[],
  ownedAnilistIds: Set<number>,
  weights: Map<string, number>,
  limit = 30,
): RecCandidate[] {
  const seen = new Set<number>()
  const unique: RecCandidate[] = []
  for (const c of cands) {
    if (ownedAnilistIds.has(c.anilistId) || seen.has(c.anilistId)) continue
    seen.add(c.anilistId)
    unique.push(c)
  }
  const score = (c: RecCandidate) =>
    c.genres.reduce((s, g) => s + (weights.get(g) ?? 0), 0) + (c.avgScore ?? 60) / 100
  return unique.sort((a, b) => score(b) - score(a)).slice(0, limit)
}
