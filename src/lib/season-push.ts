// Szezonváltás-push: az új anime-szezon első napjaiban egyszeri értesítés
// („nézd meg, mik valók neked az új szezonból"). Budapest-nap szerint.

const PART_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
})

const SEASON_BY_START_MONTH: Record<number, string> = { 1: 'WINTER', 4: 'SPRING', 7: 'SUMMER', 10: 'FALL' }
export const SEASON_PUSH_WINDOW_DAYS = 3

export function seasonStartInfo(now: Date): { year: number; season: string } | null {
  const parts = Object.fromEntries(PART_FMT.formatToParts(now).map((p) => [p.type, p.value]))
  const month = Number(parts.month)
  const day = Number(parts.day)
  const season = SEASON_BY_START_MONTH[month]
  if (!season || day > SEASON_PUSH_WINDOW_DAYS) return null
  return { year: Number(parts.year), season }
}

const SEASON_HU: Record<string, string> = {
  WINTER: 'téli', SPRING: 'tavaszi', SUMMER: 'nyári', FALL: 'őszi',
}

export function buildSeasonPayload(year: number, season: string): { title: string; body: string; url: string } {
  return {
    title: `Elindult a ${year}-es ${SEASON_HU[season] ?? season.toLowerCase()} szezon 🌸`,
    body: 'Nézd meg, mik valók neked az új szezonból — ízlésed szerint pontozva.',
    url: '/',
  }
}
