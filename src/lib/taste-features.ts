// A pontozó jelek KÖTÖTT szókészlete. Csak olyan tengely kerülhet ide, amit egy
// MÉG NEM LÁTOTT címre is elő tudunk állítani a `title` sorból — különben a jel
// sosem találkozna a jelölt feature-jeivel és nem számítana semmit.

export type FeatureSource = {
  genres: string[]
  tags: { name: string }[]
  format: string | null
  episodes: number | null
  chapters: number | null
  year: number | null
  studio: string | null
  mediaType: string
  relations: { type: string; anilistId: number; title: string }[]
}

const ANIME_BANDS: [number, string][] = [[13, 'short'], [26, 'standard'], [99, 'long']]
const MANGA_BANDS: [number, string][] = [[30, 'short'], [100, 'standard'], [300, 'long']]

export function lengthBand(src: FeatureSource): string | null {
  const isManga = src.mediaType === 'MANGA'
  const count = isManga ? src.chapters : src.episodes
  if (count == null) return null
  for (const [max, band] of isManga ? MANGA_BANDS : ANIME_BANDS) {
    if (count <= max) return band
  }
  return 'endless'
}

export function eraOf(year: number | null): string | null {
  if (year == null) return null
  return `${Math.floor(year / 10) * 10}s`
}

// Feldolgozás előtti mű van-e mögötte. Csak két érték, mert a `title.relations`
// ennél többet nem árul el megbízhatóan.
function sourceMedium(src: FeatureSource): string {
  return src.relations.some((r) => r.type === 'SOURCE') ? 'adaptation' : 'original'
}

/** Egy cím teljes feature-készlete, normalizált (kisbetűs) kulcsokként. */
export function titleFeatureKeys(src: FeatureSource): string[] {
  const band = lengthBand(src)
  const era = eraOf(src.year)
  const keys = [
    ...src.genres.map((g) => `g:${g.toLowerCase()}`),
    ...src.tags.map((t) => `t:${t.name.toLowerCase()}`),
    src.format ? `format:${src.format.toLowerCase()}` : null,
    band ? `length:${band}` : null,
    era ? `era:${era}` : null,
    src.studio ? `studio:${src.studio.toLowerCase()}` : null,
    `source:${sourceMedium(src)}`,
  ].filter((k): k is string => k !== null)
  return [...new Set(keys)]
}
