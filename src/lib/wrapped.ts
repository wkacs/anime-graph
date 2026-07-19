export type WrappedAnimeRow = {
  id: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  studio: string | null
  myScore: number | null
  mediaType: string
  durationMin: number | null
  chapters: number | null
  progress: number
  watchedAt: string | null
  createdAt: string
}

export type WrappedEpisode = { animeId: number; watchedAt: string }
export type WrappedFavChar = { name: string; image: string | null; createdAt: string }

export type WrappedData = {
  year: number
  totalEpisodes: number
  totalHours: number
  topGenres: { name: string; count: number }[]
  topStudios: { name: string; count: number }[]
  topAnime: { title: string; coverUrl: string | null; myScore: number | null }[]
  longestStreakDays: number
  favChars: { name: string; image: string | null }[]
  manga: { count: number; chapters: number } | null
}

const yearOf = (iso: string) => Number(iso.slice(0, 4))

function topCounts(values: string[], limit: number): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

export function buildWrapped(
  rows: WrappedAnimeRow[],
  episodes: WrappedEpisode[],
  favChars: WrappedFavChar[],
  year: number,
): WrappedData {
  const eps = episodes.filter((e) => yearOf(e.watchedAt) === year)
  const durByAnime = new Map(rows.map((r) => [r.id, r.durationMin ?? 24]))
  const totalHours = eps.reduce((s, e) => s + (durByAnime.get(e.animeId) ?? 24), 0) / 60

  // az év "aktív" címei: van idei epizód-log VAGY idei watchedAt
  const activeIds = new Set(eps.map((e) => e.animeId))
  const active = rows.filter((r) =>
    activeIds.has(r.id) || (r.watchedAt != null && yearOf(r.watchedAt) === year))
  const activeAnime = active.filter((r) => r.mediaType === 'ANIME')
  const activeManga = active.filter((r) => r.mediaType === 'MANGA')

  // leghosszabb egymást követő napi sorozat
  const days = [...new Set(eps.map((e) => e.watchedAt.slice(0, 10)))].sort()
  let longest = days.length ? 1 : 0
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime()
    const cur = new Date(`${days[i]}T00:00:00Z`).getTime()
    run = cur - prev === 86_400_000 ? run + 1 : 1
    if (run > longest) longest = run
  }

  const mangaIds = new Set(activeManga.map((m) => m.id))
  return {
    year,
    totalEpisodes: eps.length,
    totalHours,
    topGenres: topCounts(active.flatMap((r) => r.genres), 5),
    topStudios: topCounts(activeAnime.map((r) => r.studio).filter((s): s is string => !!s), 5),
    topAnime: [...active].filter((r) => r.myScore != null)
      .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0)).slice(0, 5)
      .map((r) => ({ title: r.titleRomaji, coverUrl: r.coverUrl, myScore: r.myScore })),
    longestStreakDays: longest,
    favChars: favChars.filter((f) => yearOf(f.createdAt) === year).slice(0, 8)
      .map((f) => ({ name: f.name, image: f.image })),
    manga: activeManga.length
      ? { count: activeManga.length, chapters: eps.filter((e) => mangaIds.has(e.animeId)).length }
      : null,
  }
}

export function availableYears(rows: WrappedAnimeRow[], episodes: WrappedEpisode[]): number[] {
  const years = new Set<number>()
  for (const e of episodes) years.add(yearOf(e.watchedAt))
  for (const r of rows) if (r.watchedAt) years.add(yearOf(r.watchedAt))
  return [...years].sort((a, b) => b - a)
}
