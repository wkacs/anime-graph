export type BrowseFilters = {
  search?: string
  type: 'ANIME' | 'MANGA'
  genre?: string
  year?: number
  format?: string
  minScore?: number
  // lokális browse-szűrők (AniList-ág nem használja őket)
  studio?: string
  season?: string
  seasonYear?: number
  sort: 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC'
  page: number
}

export const BROWSE_PER_PAGE = 24
// az AniList lapozás page*perPage <= 5000-ig ad eredményt
const ANILIST_PAGE_CAP = 5000

export function buildBrowseVariables(f: BrowseFilters): Record<string, unknown> {
  const v: Record<string, unknown> = { type: f.type, sort: f.sort, page: f.page, perPage: BROWSE_PER_PAGE }
  if (f.search) v.search = f.search
  if (f.genre) v.genre = f.genre
  if (f.format) v.format = f.format
  if (f.minScore) v.minScore = f.minScore
  if (f.year) {
    if (f.type === 'ANIME') v.seasonYear = f.year
    else {
      v.startDateGreater = f.year * 10000
      v.startDateLesser = (f.year + 1) * 10000
    }
  }
  return v
}

export function randomPage(total: number, perPage: number, rnd: () => number = Math.random): number {
  const maxPage = Math.min(Math.ceil(total / perPage), Math.floor(ANILIST_PAGE_CAP / perPage))
  if (maxPage < 1) return 1
  return 1 + Math.floor(rnd() * maxPage)
}
