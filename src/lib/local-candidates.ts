import type { RecCandidate } from './anilist'

export type FavInput = { anilistId: number; genres: string[]; relations: { anilistId: number }[] | number[] }
export type CatalogRow = {
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  tags: { name: string }[]
  communityScore: number | null
  avgScore: number | null
  relations: { anilistId: number }[]
}

// Lokális jelöltlista a `title` katalógusból — kiváltja az élő AniList „recommendations" hívást.
// Jelöltek: a kedvencek relations ID-i + a batch-cache-elt AniList-recs (recIds) + a kedvenc-genre-ökkel
// átfedő címek, minőség (communityScore ?? avgScore) szerint rangsorolva.
export function buildLocalCandidates(
  favorites: FavInput[],
  catalog: CatalogRow[],
  ownedAnilistIds: Set<number>,
  limit = 200,
  recIds: Set<number> = new Set(),
): RecCandidate[] {
  const relIds = new Set<number>()
  for (const f of favorites) {
    for (const r of f.relations as Array<number | { anilistId: number }>) {
      relIds.add(typeof r === 'number' ? r : r.anilistId)
    }
  }
  const favGenres = new Set(favorites.flatMap((f) => f.genres))
  const favAnilist = new Set(favorites.map((f) => f.anilistId))

  const scored = catalog
    .filter((c) => !ownedAnilistIds.has(c.anilistId) && !favAnilist.has(c.anilistId))
    .map((c) => {
      const genreOverlap = c.genres.filter((g) => favGenres.has(g)).length
      const isRelation = relIds.has(c.anilistId) ? 1 : 0
      const isRec = recIds.has(c.anilistId) ? 1 : 0
      if (genreOverlap === 0 && !isRelation && !isRec) return null
      const quality = c.communityScore ?? (c.avgScore != null ? c.avgScore / 10 : 6)
      return { c, key: isRelation * 100 + isRec * 80 + genreOverlap * 5 + quality }
    })
    .filter((x): x is { c: CatalogRow; key: number } => x !== null)
    .sort((a, b) => b.key - a.key)
    .slice(0, limit)

  return scored.map(({ c }): RecCandidate => ({
    anilistId: c.anilistId,
    title: c.titleRomaji,
    coverUrl: c.coverUrl,
    genres: c.genres,
    tags: c.tags,
    avgScore: c.avgScore,
  }))
}
