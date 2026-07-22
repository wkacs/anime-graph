// A publikus (jelszó nélküli) nézetbe SOHA nem mehet vélemény-szöveg,
// ízlés-memória vagy privát opinion-adat. Ez a fehérlista a kizárólagos kapu.
export const PUBLIC_ANIME_KEYS = ['title', 'coverUrl', 'status', 'myScore', 'year'] as const

export type PublicAnime = {
  title: string
  coverUrl: string | null
  status: string
  myScore: number | null
  year: number | null
}

export type PublicAnimeInput = {
  titleRomaji: string
  coverUrl: string | null
  status: string
  myScore: number | null
  year: number | null
}

export function toPublicAnime(row: PublicAnimeInput): PublicAnime {
  return {
    title: row.titleRomaji,
    coverUrl: row.coverUrl,
    status: row.status,
    myScore: row.myScore,
    year: row.year,
  }
}
