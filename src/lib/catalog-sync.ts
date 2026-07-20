export function nextPageVars(page: number, perPage: number) {
  return { page, perPage }
}

// AniList caps at 90 req/min. Given the rate-limit headers, decide how long to
// wait before the next request so we never trip 429.
export function sleepMsFor(remaining: number, resetInSec: number): number {
  const resetMs = Math.max(0, resetInSec) * 1000
  if (remaining <= 0) return resetMs
  if (remaining > 10) return 0
  return Math.round(resetMs / remaining)
}
