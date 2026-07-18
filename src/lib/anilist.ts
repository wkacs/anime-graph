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

// shared media field selection — MEDIA_QUERY, list import and MAL batch all map through mapMedia
const MEDIA_FIELDS = `
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
    relations { edges { relationType node { id type title { romaji } } } }`

const MEDIA_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {${MEDIA_FIELDS}
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

export type AnilistListEntry = {
  status: string
  score: number | null
  progress: number
  completedAt: { year: number | null; month: number | null; day: number | null } | null
  media: AnilistMedia
}

const LIST_QUERY = `
query ($userName: String!) {
  MediaListCollection(userName: $userName, type: ANIME) {
    lists {
      entries {
        status
        score(format: POINT_10)
        progress
        completedAt { year month day }
        media {${MEDIA_FIELDS}
        }
      }
    }
  }
}`

export async function fetchUserList(userName: string): Promise<AnilistListEntry[]> {
  type R = { MediaListCollection: { lists: { entries: AnilistListEntry[] }[] } | null }
  const data = await anilistFetch<R>(LIST_QUERY, { userName })
  if (!data.MediaListCollection) return []
  return data.MediaListCollection.lists.flatMap((l) => l.entries)
}

const MAL_BATCH_QUERY = `
query ($malIds: [Int!]) {
  Page(perPage: 50) {
    media(idMal_in: $malIds, type: ANIME) {
      idMal${MEDIA_FIELDS}
    }
  }
}`

export async function fetchByMalIds(malIds: number[]): Promise<(AnilistMedia & { idMal: number })[]> {
  type R = { Page: { media: (AnilistMedia & { idMal: number })[] } }
  const data = await anilistFetch<R>(MAL_BATCH_QUERY, { malIds })
  return data.Page.media
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

const SEASON_QUERY = `
query ($season: MediaSeason!, $seasonYear: Int!) {
  Page(perPage: 25) {
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji }
      coverImage { large }
      genres
      averageScore
    }
  }
}`

export async function fetchSeason(season: string, seasonYear: number): Promise<RecCandidate[]> {
  type R = { Page: { media: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null }[] } }
  const data = await anilistFetch<R>(SEASON_QUERY, { season, seasonYear })
  return data.Page.media.map((m) => ({
    anilistId: m.id,
    title: m.title.romaji,
    coverUrl: m.coverImage?.large ?? null,
    genres: m.genres,
    avgScore: m.averageScore,
  }))
}

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
