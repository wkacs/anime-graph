import type { AnimeInsert } from '@/db/schema'

const API = 'https://graphql.anilist.co'

export type AnilistMedia = {
  id: number
  type: string | null
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
  description: string | null
  chapters: number | null
  volumes: number | null
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
  description: string | null
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
query ($search: String!, $type: MediaType!) {
  Page(perPage: 10) {
    media(search: $search, type: $type) {
      id
      title { romaji english }
      coverImage { large }
      seasonYear
      format
      genres
      description
    }
  }
}`

export async function searchAnime(q: string, type: 'ANIME' | 'MANGA' = 'ANIME'): Promise<SearchResult[]> {
  type R = { Page: { media: { id: number; title: { romaji: string; english: string | null }; coverImage: { large: string | null } | null; seasonYear: number | null; format: string | null; genres: string[]; description: string | null }[] } }
  const data = await anilistFetch<R>(SEARCH_QUERY, { search: q, type })
  return data.Page.media.map((m) => ({
    anilistId: m.id,
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    coverUrl: m.coverImage?.large ?? null,
    year: m.seasonYear,
    format: m.format,
    genres: m.genres,
    description: m.description,
  }))
}

// shared media field selection — MEDIA_QUERY, list import and MAL batch all map through mapMedia
const MEDIA_FIELDS = `
    id
    type
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
    description
    chapters
    volumes
    averageScore
    trailer { id site }
    relations { edges { relationType node { id type title { romaji } } } }`

const MEDIA_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {${MEDIA_FIELDS}
  }
}`

const MEDIA_QUERY_ANY = `
query ($id: Int!) {
  Media(id: $id) {${MEDIA_FIELDS}
  }
}`

// any=true: típus-szűrő nélkül (manga-id-ra is működik)
export async function fetchMedia(anilistId: number, any = false): Promise<AnilistMedia> {
  const data = await anilistFetch<{ Media: AnilistMedia }>(any ? MEDIA_QUERY_ANY : MEDIA_QUERY, { id: anilistId })
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
    mediaType: m.type ?? 'ANIME',
    chapters: m.chapters,
    volumes: m.volumes,
    description: m.description,
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
query ($userName: String!, $type: MediaType!) {
  MediaListCollection(userName: $userName, type: $type) {
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

export async function fetchUserList(userName: string, type: 'ANIME' | 'MANGA' = 'ANIME'): Promise<AnilistListEntry[]> {
  type R = { MediaListCollection: { lists: { entries: AnilistListEntry[] }[] } | null }
  const data = await anilistFetch<R>(LIST_QUERY, { userName, type })
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

export type SeasonMedia = RecCandidate & {
  episodes: number | null
  format: string | null
  description: string | null
  airingAt: number | null // unix seconds of the next episode, null if not airing
  nextEpisode: number | null
}

const SEASON_QUERY = `
query ($season: MediaSeason!, $seasonYear: Int!) {
  Page(perPage: 25) {
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji }
      coverImage { large }
      genres
      averageScore
      episodes
      format
      description
      nextAiringEpisode { airingAt episode }
    }
  }
}`

export async function fetchSeason(season: string, seasonYear: number): Promise<SeasonMedia[]> {
  type R = { Page: { media: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null; episodes: number | null; format: string | null; description: string | null; nextAiringEpisode: { airingAt: number; episode: number } | null }[] } }
  const data = await anilistFetch<R>(SEASON_QUERY, { season, seasonYear })
  return data.Page.media.map((m) => ({
    anilistId: m.id,
    title: m.title.romaji,
    coverUrl: m.coverImage?.large ?? null,
    genres: m.genres,
    avgScore: m.averageScore,
    episodes: m.episodes,
    format: m.format,
    description: m.description,
    airingAt: m.nextAiringEpisode?.airingAt ?? null,
    nextEpisode: m.nextAiringEpisode?.episode ?? null,
  }))
}

export type CharacterEntry = {
  charId: number
  name: string
  image: string | null
  role: string
  vaId: number | null
  vaName: string | null
  vaImage: string | null
}

const CHARACTERS_QUERY = `
query ($id: Int!) {
  Media(id: $id) {
    characters(role_in: [MAIN, SUPPORTING], perPage: 12, sort: [ROLE, RELEVANCE]) {
      edges {
        role
        node { id name { full } image { medium } }
        voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full } image { medium } }
      }
    }
  }
}`

export async function fetchCharacters(anilistId: number): Promise<CharacterEntry[]> {
  type R = { Media: { characters: { edges: { role: string; node: { id: number; name: { full: string }; image: { medium: string | null } | null }; voiceActors: { id: number; name: { full: string }; image: { medium: string | null } | null }[] }[] } } }
  const data = await anilistFetch<R>(CHARACTERS_QUERY, { id: anilistId })
  return data.Media.characters.edges.map((e) => ({
    charId: e.node.id,
    name: e.node.name.full,
    image: e.node.image?.medium ?? null,
    role: e.role,
    vaId: e.voiceActors[0]?.id ?? null,
    vaName: e.voiceActors[0]?.name.full ?? null,
    vaImage: e.voiceActors[0]?.image?.medium ?? null,
  }))
}

export type BrowseMedia = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  format: string | null
  year: number | null
  description: string | null
}

const BROWSE_QUERY = `
query ($type: MediaType!, $sort: [MediaSort], $page: Int!, $perPage: Int!, $search: String,
       $genre: String, $format: MediaFormat, $minScore: Int, $seasonYear: Int,
       $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total }
    media(type: $type, sort: $sort, search: $search, genre: $genre, format: $format,
          averageScore_greater: $minScore, seasonYear: $seasonYear,
          startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser) {
      id
      title { romaji }
      coverImage { large }
      genres
      averageScore
      format
      seasonYear
      startDate { year }
      description
    }
  }
}`

export async function fetchBrowse(variables: Record<string, unknown>): Promise<{ total: number; media: BrowseMedia[] }> {
  type R = { Page: { pageInfo: { total: number }; media: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null; format: string | null; seasonYear: number | null; startDate: { year: number | null } | null; description: string | null }[] } }
  const data = await anilistFetch<R>(BROWSE_QUERY, variables)
  return {
    total: data.Page.pageInfo.total,
    media: data.Page.media.map((m) => ({
      anilistId: m.id,
      title: m.title.romaji,
      coverUrl: m.coverImage?.large ?? null,
      genres: m.genres,
      avgScore: m.averageScore,
      format: m.format,
      year: m.seasonYear ?? m.startDate?.year ?? null,
      description: m.description,
    })),
  }
}

export type AiringInfo = { anilistId: number; airingAt: number; nextEpisode: number }

const AIRING_QUERY = `
query ($ids: [Int!]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      nextAiringEpisode { airingAt episode }
    }
  }
}`

// next-episode times for the given AniList ids (only airing ones come back)
export async function fetchAiringFor(anilistIds: number[]): Promise<AiringInfo[]> {
  type R = { Page: { media: { id: number; nextAiringEpisode: { airingAt: number; episode: number } | null }[] } }
  const out: AiringInfo[] = []
  for (let i = 0; i < anilistIds.length; i += 50) {
    const data = await anilistFetch<R>(AIRING_QUERY, { ids: anilistIds.slice(i, i + 50) })
    for (const m of data.Page.media) {
      if (m.nextAiringEpisode) {
        out.push({ anilistId: m.id, airingAt: m.nextAiringEpisode.airingAt, nextEpisode: m.nextAiringEpisode.episode })
      }
    }
  }
  return out
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
