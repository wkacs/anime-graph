// A News-oldal szezon-rácsának rendezése és szűrése — UI-mentes, tesztelhető réteg.

export type SeasonViewItem = {
  anilistId: number
  genres: string[]
  format: string | null
  avgScore: number | null
  airingAt: number | null
  tasteScore: number | null
  streaming?: { site: string; url: string }[]
}

export type SeasonSort = 'taste' | 'airing' | 'score' | 'popularity'

export type SeasonView = {
  sort: SeasonSort
  genres: string[]
  formats: string[]
  sites: string[]
  minScore: number
}

export const EMPTY_SEASON_VIEW: SeasonView = {
  sort: 'taste',
  genres: [],
  formats: [],
  sites: [],
  minScore: 0,
}

export const SORT_LABELS: Record<SeasonSort, string> = {
  taste: 'Ízlés-pont',
  airing: 'Adásidő',
  score: 'AniList-pont',
  popularity: 'Népszerűség',
}

export const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV rövid',
  MOVIE: 'Film',
  ONA: 'ONA',
  OVA: 'OVA',
  SPECIAL: 'Special',
}

export const MIN_SCORE_STEPS = [0, 50, 60, 70, 80]

export function seasonFacets(items: SeasonViewItem[]): {
  genres: string[]
  formats: string[]
  sites: string[]
} {
  const genres = new Set<string>()
  const formats = new Set<string>()
  const sites = new Set<string>()
  for (const i of items) {
    for (const g of i.genres) genres.add(g)
    if (i.format) formats.add(i.format)
    for (const s of i.streaming ?? []) sites.add(s.site)
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b))
  return { genres: sorted(genres), formats: sorted(formats), sites: sorted(sites) }
}

function matches(item: SeasonViewItem, view: SeasonView): boolean {
  // dimenziók közt AND, dimenzión belül OR
  if (view.genres.length && !view.genres.some((g) => item.genres.includes(g))) return false
  if (view.formats.length && !(item.format && view.formats.includes(item.format))) return false
  if (view.sites.length && !(item.streaming ?? []).some((s) => view.sites.includes(s.site))) return false
  // pont nélküli cím minden 0 feletti küszöb alatt van — nem tudjuk, hogy jó-e
  if (view.minScore > 0 && (item.tasteScore == null || item.tasteScore < view.minScore)) return false
  return true
}

// hiányzó érték mindig a lista végére, a rendezés irányától függetlenül
const LAST = Number.POSITIVE_INFINITY

function sortKey(item: SeasonViewItem, sort: SeasonSort): number {
  switch (sort) {
    case 'taste':
      return item.tasteScore == null ? LAST : -item.tasteScore
    case 'score':
      return item.avgScore == null ? LAST : -item.avgScore
    case 'airing':
      return item.airingAt ?? LAST
    case 'popularity':
      return 0 // a beérkezési sorrend maradjon
  }
}

export function applySeasonView<T extends SeasonViewItem>(items: T[], view: SeasonView): T[] {
  return items
    .filter((i) => matches(i, view))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      // különbség helyett összehasonlítás: az Infinity-Infinity NaN-t adna
      const ka = sortKey(a.item, view.sort)
      const kb = sortKey(b.item, view.sort)
      if (ka !== kb) return ka < kb ? -1 : 1
      return a.index - b.index
    })
    .map((x) => x.item)
}
