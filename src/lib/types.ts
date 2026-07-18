import type { AnimeSelect } from '@/db/schema'

// anime row as it arrives over JSON (dates serialized)
export type ApiAnime = Omit<AnimeSelect, 'watchedAt' | 'createdAt'> & {
  watchedAt: string | null
  createdAt: string
}

export type ApiFact = { id: number; animeId: number | null; kind: string; text: string }
