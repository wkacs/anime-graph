// weekday index in Budapest time: 0 = hétfő … 6 = vasárnap
export function weekdayIndexBudapest(unixSeconds: number): number {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Europe/Budapest',
  }).format(new Date(unixSeconds * 1000))
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name)
}

export const WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'hamarosan'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}n ${h}ó`
  if (h > 0) return `${h}ó ${m}p`
  return `${m}p`
}
