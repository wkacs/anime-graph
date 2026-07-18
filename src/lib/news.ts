export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'hamarosan'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}n ${h}ó`
  if (h > 0) return `${h}ó ${m}p`
  return `${m}p`
}
