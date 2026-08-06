// A publikus /u/[username] profil stat-blokkjainak pure aggregátora.
// Vélemény/ízlés-adat ide be sem jön — a hívó csak whitelistelt oszlopokat ad.

export type ProfileStatsRow = {
  titleRomaji: string
  coverUrl: string | null
  slug: string
  mediaType: string
  status: string
  myScore: number | null
  year: number | null
  genres: string[]
  durationMin: number | null
  episodes: number | null
  progress: number
}

export type ProfileTopTitle = {
  title: string
  coverUrl: string | null
  slug: string
  mediaType: string
  myScore: number
}

export type ProfileStats = {
  total: number
  completed: number
  watchedHours: number
  avgScore: number | null
  topGenres: { name: string; count: number }[]
  scoreDist: { label: string; count: number }[]
  statusCounts: { status: string; count: number }[]
  topTitles: ProfileTopTitle[]
}

export const PROFILE_STATUS_ORDER = ['completed', 'watching', 'planned', 'dropped'] as const

const TOP_TITLE_COUNT = 10

export function buildProfileStats(rows: ProfileStatsRow[]): ProfileStats {
  const watchedMinutes = rows.reduce((sum, a) => {
    const dur = a.durationMin ?? 24
    const eps = a.status === 'completed' ? (a.episodes ?? a.progress) : a.progress
    return sum + dur * (eps ?? 0)
  }, 0)

  const scored = rows.filter((a) => a.myScore != null)
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, a) => s + (a.myScore ?? 0), 0) / scored.length) * 10) / 10
    : null

  const genreCounts = new Map<string, number>()
  for (const a of rows) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const topGenres = [...genreCounts.entries()]
    .sort((x, y) => y[1] - x[1]).slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  const scoreDist = Array.from({ length: 10 }, (_, i) => ({
    label: String(i + 1),
    count: rows.filter((a) => a.myScore === i + 1).length,
  }))

  const statusCounts = PROFILE_STATUS_ORDER.map((s) => ({
    status: s as string,
    count: rows.filter((a) => a.status === s).length,
  }))

  // Stabil sorrend azonos pontnál: cím szerint — a profil ne "ugráljon" reloadonként.
  const topTitles = scored
    .slice()
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0)
      || a.titleRomaji.localeCompare(b.titleRomaji))
    .slice(0, TOP_TITLE_COUNT)
    .map((a) => ({
      title: a.titleRomaji,
      coverUrl: a.coverUrl,
      slug: a.slug,
      mediaType: a.mediaType,
      myScore: a.myScore as number,
    }))

  return {
    total: rows.length,
    completed: statusCounts.find((s) => s.status === 'completed')?.count ?? 0,
    watchedHours: Math.round(watchedMinutes / 60),
    avgScore,
    topGenres,
    scoreDist,
    statusCounts,
    topTitles,
  }
}
