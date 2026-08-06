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
  isAdult: boolean
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

export async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown>,
  options: { attempts?: number; timeoutMs?: number } = {},
): Promise<T> {
  // Importoknál több kérés fut egymás után. Egy rövid AniList 429 ezért nem
  // nullázza le az egész folyamatot: a Retry-After szerint még kétszer próbálunk.
  const attempts = options.attempts ?? 3
  const timeoutMs = options.timeoutMs ?? 15_000
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 429 && attempt < attempts - 1) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const delayMs = Math.min(5000, Math.max(500, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000))
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      continue
    }
    if (!res.ok) {
      // A statusz maga is informacio: a 404 „nincs ilyen felhasznalo/cim", nem
      // kimaradas. A hivo igy kulon tudja kezelni, uzenet-parszolas nelkul.
      const err = new Error(`AniList HTTP ${res.status}`) as Error & { status?: number }
      err.status = res.status
      throw err
    }
    const json = await res.json()
    if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`)
    return json.data as T
  }
  throw new Error('AniList HTTP 429')
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

// shared media field selection — MEDIA_QUERY, list import, MAL batch and the
// daily catalog-sync cron all map through mapTitle
export const MEDIA_FIELDS = `
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
    isAdult
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
  // opcionalis: az elo AniList-agak nem toltik, a lokalis katalogus-ut igen.
  // A fit-vektor a tageken a legerosebb, ezert a jelolt-uton at kell vinni.
  tags?: { name: string }[]
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

export type StreamLink = { site: string; url: string }

type RawExternalLink = { site: string; url: string | null; type: string }

const mapStreaming = (links: RawExternalLink[] | null | undefined): StreamLink[] =>
  (links ?? [])
    .filter((l): l is RawExternalLink & { url: string } => l.type === 'STREAMING' && !!l.url)
    .slice(0, 3)
    .map((l) => ({ site: l.site, url: l.url }))

export type SeasonMedia = RecCandidate & {
  episodes: number | null
  format: string | null
  description: string | null
  airingAt: number | null // unix seconds of the next episode, null if not airing
  nextEpisode: number | null
  streaming: StreamLink[]
}

const SEASON_QUERY = `
query ($season: MediaSeason!, $seasonYear: Int!) {
  Page(perPage: 25) {
    media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji }
      coverImage { large }
      genres
      tags { name }
      averageScore
      episodes
      format
      description
      nextAiringEpisode { airingAt episode }
      externalLinks { site url type }
    }
  }
}`

export async function fetchSeason(season: string, seasonYear: number): Promise<SeasonMedia[]> {
  type R = { Page: { media: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; tags: { name: string }[] | null; averageScore: number | null; episodes: number | null; format: string | null; description: string | null; nextAiringEpisode: { airingAt: number; episode: number } | null; externalLinks: RawExternalLink[] | null }[] } }
  const data = await anilistFetch<R>(SEASON_QUERY, { season, seasonYear })
  return data.Page.media.map((m) => ({
    anilistId: m.id,
    title: m.title.romaji,
    coverUrl: m.coverImage?.large ?? null,
    genres: m.genres,
    // a fit-vektor a tageken a legerosebb — enelkul a lokalis szezon-pontozas felig vak
    tags: m.tags ?? [],
    avgScore: m.averageScore,
    episodes: m.episodes,
    format: m.format,
    description: m.description,
    airingAt: m.nextAiringEpisode?.airingAt ?? null,
    nextEpisode: m.nextAiringEpisode?.episode ?? null,
    streaming: mapStreaming(m.externalLinks),
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

// FIGYELEM: a characters-mezőnek nincs role_in argumentuma (HTTP 400-at ad rá
// az AniList) — a szerep-szűrés ezért a válaszon történik. A ROLE-sort miatt a
// MAIN/SUPPORTING áll elöl, így a 12-es lapon ritkán marad BACKGROUND.
const CHARACTERS_QUERY = `
query ($id: Int!) {
  Media(id: $id) {
    characters(perPage: 12, sort: [ROLE, RELEVANCE]) {
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
  return data.Media.characters.edges
    .filter((e) => e.role === 'MAIN' || e.role === 'SUPPORTING')
    .map((e) => ({
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
  streaming: StreamLink[]
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
      externalLinks { site url type }
    }
  }
}`

export async function fetchBrowse(variables: Record<string, unknown>): Promise<{ total: number; media: BrowseMedia[] }> {
  type R = { Page: { pageInfo: { total: number }; media: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null; format: string | null; seasonYear: number | null; startDate: { year: number | null } | null; description: string | null; externalLinks: RawExternalLink[] | null }[] } }
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
      streaming: mapStreaming(m.externalLinks),
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

export type StaffEntry = { staffId: number; name: string; image: string | null; role: string }

const STAFF_QUERY = `
query ($id: Int!) {
  Media(id: $id) {
    staff(perPage: 12, sort: RELEVANCE) {
      edges { role node { id name { full } image { medium } } }
    }
  }
}`

export async function fetchDirectors(anilistId: number): Promise<StaffEntry[]> {
  type R = { Media: { staff: { edges: { role: string; node: { id: number; name: { full: string }; image: { medium: string | null } | null } }[] } } }
  const data = await anilistFetch<R>(STAFF_QUERY, { id: anilistId })
  return data.Media.staff.edges
    .filter((e) => e.role === 'Director')
    .map((e) => ({ staffId: e.node.id, name: e.node.name.full, image: e.node.image?.medium ?? null, role: e.role }))
}

// teljes stáb-lista szűrés nélkül — a rangsorolást a staff-cache végzi
export async function fetchStaff(anilistId: number): Promise<StaffEntry[]> {
  type R = { Media: { staff: { edges: { role: string; node: { id: number; name: { full: string }; image: { medium: string | null } | null } }[] } } }
  const data = await anilistFetch<R>(STAFF_QUERY, { id: anilistId })
  return data.Media.staff.edges
    .map((e) => ({ staffId: e.node.id, name: e.node.name.full, image: e.node.image?.medium ?? null, role: e.role }))
}

// A Taste Scan sajat, szuk lekerese. Szandekosan NEM a MEDIA_FIELDS megy ki:
// egy 500 cimes listanal a description es a relations tobb megabajt felesleges
// atvitel, viszont kell a `popularity`, ami a katalogus-syncnek nem kell.
const SCAN_LIST_QUERY = `
query ($userName: String!, $type: MediaType!) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      entries {
        status
        score(format: POINT_10)
        media {
          id
          title { romaji english }
          coverImage { large }
          genres
          tags { name rank }
          studios(isMain: true) { nodes { name } }
          seasonYear
          averageScore
          popularity
          isAdult
        }
      }
    }
  }
}`

export type ScanListEntry = {
  status: string
  score: number | null
  media: {
    id: number
    title: { romaji: string; english: string | null }
    coverImage: { large: string | null } | null
    genres: string[]
    tags: { name: string; rank: number }[]
    studios: { nodes: { name: string }[] }
    seasonYear: number | null
    averageScore: number | null
    popularity: number | null
    isAdult: boolean
  }
}

/** Publikus AniList-lista scanhez. Privat vagy nem letezo profil: ures tomb. */
export async function fetchUserListForScan(
  userName: string,
  type: 'ANIME' | 'MANGA' = 'ANIME',
): Promise<ScanListEntry[]> {
  type R = { MediaListCollection: { lists: { entries: ScanListEntry[] }[] } | null }
  const data = await anilistFetch<R>(SCAN_LIST_QUERY, { userName, type })
  if (!data.MediaListCollection) return []
  return data.MediaListCollection.lists.flatMap((l) => l.entries)
}
