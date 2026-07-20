import type { AnilistMedia } from './anilist'
import type { TagEntry, RelationEntry } from '@/db/schema'

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')  // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function titleSlug(titleRomaji: string, anilistId: number): string {
  const base = slugify(titleRomaji)
  return base ? `${base}-${anilistId}` : `title-${anilistId}`
}

export type TitleMetadata = {
  anilistId: number
  mediaType: string
  slug: string
  titleRomaji: string
  titleEnglish: string | null
  titleNative: string | null
  coverUrl: string | null
  bannerUrl: string | null
  genres: string[]
  tags: TagEntry[]
  studio: string | null
  season: string | null
  year: number | null
  episodes: number | null
  durationMin: number | null
  format: string | null
  chapters: number | null
  volumes: number | null
  description: string | null
  relations: RelationEntry[]
  trailerSite: string | null
  trailerId: string | null
  avgScore: number | null
}

export function mapTitle(m: AnilistMedia): TitleMetadata {
  const mediaType = m.type === 'MANGA' ? 'MANGA' : 'ANIME'
  return {
    anilistId: m.id,
    mediaType,
    slug: titleSlug(m.title.romaji, m.id),
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    titleNative: m.title.native,
    coverUrl: m.coverImage?.large ?? null,
    bannerUrl: m.bannerImage,
    genres: m.genres ?? [],
    tags: m.tags ?? [],
    studio: m.studios?.nodes?.[0]?.name ?? null,
    season: m.season,
    year: m.seasonYear,
    episodes: m.episodes,
    durationMin: m.duration,
    format: m.format,
    chapters: m.chapters,
    volumes: m.volumes,
    description: m.description,
    relations: (m.relations?.edges ?? []).map((e) => ({
      type: e.relationType, anilistId: e.node.id, title: e.node.title.romaji,
    })),
    trailerSite: m.trailer?.site ?? null,
    trailerId: m.trailer?.id ?? null,
    avgScore: m.averageScore,
  }
}
