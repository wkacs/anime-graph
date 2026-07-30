// A vendég-landing vizuáljai a /api/trending valódi title-soraiból épülnek:
// a hero-kollázs és a katalógus-teaser is innen válogat.
export type LandingCover = {
  anilistId: number
  mediaType: string
  slug: string
  titleRomaji: string
  titleEnglish: string | null
  coverUrl: string | null
  format: string | null
  year: number | null
  avgScore: number | null
}

// Szezonális előre (pont szerint már rendezett, friss és felismerhető), a
// popular a tartalék. Borító nélkül egy cím sem használható vizuálnak.
export function pickLandingCovers(
  seasonal: LandingCover[],
  popular: LandingCover[],
  n: number,
): LandingCover[] {
  const out: LandingCover[] = []
  const seen = new Set<number>()
  for (const c of [...seasonal, ...popular]) {
    if (!c.coverUrl || seen.has(c.anilistId)) continue
    seen.add(c.anilistId)
    out.push(c)
    if (out.length >= n) break
  }
  return out
}
