import type { AnimeInsert } from '@/db/schema'

const API = 'https://graphql.anilist.co'

export type AnilistMedia = {
  id: number
  title: { romaji: string; english: string | null; native: string | null }
  coverImage: { large: string | null } | null
  bannerImage: string | null
  genres: string[]
  tags: { name: string; rank: number }[]
  studios: { nodes: { name: string }[] }
  season: string | null
  seasonYear: number | null
  episodes: number | null
  duration: number | null
  format: string | null
  averageScore: number | null
  trailer: { id: string; site: string } | null
  relations: { edges: { relationType: string; node: { id: number; type: string; title: { romaji: string } } }[] }
}

export type SearchResult = {
  anilistId: number
  titleRomaji: string
  titleEnglish: string | null
  coverUrl: string | null
  year: number | null
  format: string | null
  genres: string[]
}

export async function anilistFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`)
  return json.data as T
}

const SEARCH_QUERY = `
query ($search: String!) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english }
      coverImage { large }
      seasonYear
      format
      genres
    }
  }
}`

export async function searchAnime(q: string): Promise<SearchResult[]> {
  type R = { Page: { media: { id: number; title: { romaji: string; english: string | null }; coverImage: { large: string | null } | null; seasonYear: number | null; format: string | null; genres: string[] }[] } }
  const data = await anilistFetch<R>(SEARCH_QUERY, { search: q })
  return data.Page.media.map((m) => ({
    anilistId: m.id,
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    coverUrl: m.coverImage?.large ?? null,
    year: m.seasonYear,
    format: m.format,
    genres: m.genres,
  }))
}

const MEDIA_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    coverImage { large }
    bannerImage
    genres
    tags { name rank }
    studios(isMain: true) { nodes { name } }
    season
    seasonYear
    episodes
    duration
    format
    averageScore
    trailer { id site }
    relations { edges { relationType node { id type title { romaji } } } }
  }
}`

export async function fetchMedia(anilistId: number): Promise<AnilistMedia> {
  const data = await anilistFetch<{ Media: AnilistMedia }>(MEDIA_QUERY, { id: anilistId })
  return data.Media
}

export function mapMedia(m: AnilistMedia): AnimeInsert {
  return {
    anilistId: m.id,
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    titleNative: m.title.native,
    coverUrl: m.coverImage?.large ?? null,
    bannerUrl: m.bannerImage,
    genres: m.genres ?? [],
    tags: (m.tags ?? []).map((t) => ({ name: t.name, rank: t.rank })),
    studio: m.studios.nodes[0]?.name ?? null,
    season: m.season,
    year: m.seasonYear,
    episodes: m.episodes,
    durationMin: m.duration,
    format: m.format,
    relations: m.relations.edges
      .filter((e) => e.node.type === 'ANIME')
      .map((e) => ({ type: e.relationType, anilistId: e.node.id, title: e.node.title.romaji })),
    trailerSite: m.trailer?.site ?? null,
    trailerId: m.trailer?.id ?? null,
    avgScore: m.averageScore,
  }
}

export type RecCandidate = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
}

const MEDIA_RECS_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    recommendations(perPage: 10, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          id
          title { romaji }
          coverImage { large }
          genres
          averageScore
        }
      }
    }
  }
}`

export async function fetchRecommendationsFor(anilistId: number): Promise<RecCandidate[]> {
  type R = { Media: { recommendations: { nodes: { mediaRecommendation: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null } | null }[] } } }
  const data = await anilistFetch<R>(MEDIA_RECS_QUERY, { id: anilistId })
  return data.Media.recommendations.nodes
    .map((n) => n.mediaRecommendation)
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => ({
      anilistId: m.id,
      title: m.title.romaji,
      coverUrl: m.coverImage?.large ?? null,
      genres: m.genres,
      avgScore: m.averageScore,
    }))
}
