import type { FeedItem } from '@/lib/feed'

export type MineItem = {
  animeId: number
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  description: string | null
  status: string
  progress: number
  episodes: number | null
  airingAt: number
  nextEpisode: number
}

export type SeasonItem = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  episodes: number | null
  format: string | null
  description: string | null
  airingAt: number | null
  nextEpisode: number | null
  owned: boolean
  tasteScore: number | null
  tasteReason: string | null
  streaming?: { site: string; url: string }[]
}

export type NewsData = {
  season: { season: string; year: number }
  mine: MineItem[]
  seasonItems: SeasonItem[]
}

// a teljes next-season rács sorai a lokális katalógusból (/api/browse?season=next)
export type NextSeasonRow = {
  id: number
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  slug: string
  mediaType: string
  format: string | null
}

export type WatchItem = {
  id: number
  userId: number
  anilistId: number
  mediaType: string
  title: string
  coverUrl: string | null
  watchedEpisodes: number
}

export type UpcomingItem = SeasonItem & { tasteScore: number; tasteReason: string }

export type { FeedItem }
