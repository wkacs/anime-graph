import type { RelationEntry, TagEntry } from '@/db/schema'

export type OfflineEntry = {
  sources: string[]
  title: string
  type?: string
  episodes?: number
  animeSeason?: { season?: string; year?: number }
  picture?: string
  duration?: { value?: number; unit?: string }
  score?: { median?: number }
  studios?: string[]
  relatedAnime?: string[]
  tags?: string[]
}

export type MappedTitle = {
  anilistId: number
  malId: number | null
  titleRomaji: string
  coverUrl: string | null
  episodes: number | null
  season: string | null
  year: number | null
  studio: string | null
  durationMin: number | null
  avgScore: number | null
  genres: string[]
  tags: TagEntry[]
  relations: RelationEntry[]
}

const idFrom = (sources: string[], host: string): number | null => {
  for (const s of sources) {
    const m = s.match(new RegExp(`${host}/anime/(\\d+)`))
    if (m) return Number(m[1])
  }
  return null
}
export const parseAnilistId = (sources: string[]) => idFrom(sources, 'anilist\\.co')
export const parseMalId = (sources: string[]) => idFrom(sources, 'myanimelist\\.net')

// az AniList „genre" egy zárt, kis halmaz — az offline-db tag-jei közül csak ezek genre-k
const KNOWN_GENRES = new Set([
  'action', 'adventure', 'comedy', 'drama', 'ecchi', 'fantasy', 'horror', 'mahou shoujo',
  'mecha', 'music', 'mystery', 'psychological', 'romance', 'sci-fi', 'slice of life',
  'sports', 'supernatural', 'thriller',
])

export function mapOfflineEntry(entry: OfflineEntry): MappedTitle | null {
  const anilistId = parseAnilistId(entry.sources)
  if (anilistId == null) return null
  const tags = entry.tags ?? []
  const durSec = entry.duration?.unit === 'SECONDS' ? entry.duration?.value : undefined
  const relations: RelationEntry[] = (entry.relatedAnime ?? [])
    .map((u) => parseAnilistId([u]))
    .filter((id): id is number => id != null)
    .map((id) => ({ type: 'RELATED', anilistId: id, title: '' }))
  return {
    anilistId,
    malId: parseMalId(entry.sources),
    titleRomaji: entry.title,
    coverUrl: entry.picture ?? null,
    episodes: entry.episodes ?? null,
    season: entry.animeSeason?.season ?? null,
    year: entry.animeSeason?.year ?? null,
    studio: entry.studios?.[0] ?? null,
    durationMin: durSec ? Math.round(durSec / 60) : null,
    avgScore: entry.score?.median != null ? Math.round(entry.score.median * 10) : null,
    genres: tags.filter((t) => KNOWN_GENRES.has(t.toLowerCase())),
    tags: tags.map((name) => ({ name, rank: 0 })),
    relations,
  }
}
