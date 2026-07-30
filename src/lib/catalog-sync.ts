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

// ── inkrementális napi sync (UPDATED_AT_DESC + vízjel) ──────────────────────
// A teljes katalógus-sync órákig tart, serverless cronba nem fér. A napi cron
// ezért csak a vízjel óta MÓDOSULT címeket kéri le: UPDATED_AT_DESC rendezés
// mellett addig lapoz, amíg a lap legrégebbi eleme is frissebb a vízjelnél.

export type UpdatedStamp = { updatedAt: number }

/** A vízjelnél frissebb elemek + kell-e még lapozni (a lap alja is frissebb). */
export function sliceNewMedia<T extends UpdatedStamp>(
  media: T[],
  watermarkSec: number,
): { fresh: T[]; morePages: boolean } {
  const fresh = media.filter((m) => m.updatedAt > watermarkSec)
  return { fresh, morePages: media.length > 0 && fresh.length === media.length }
}

/** Első futáskor (nincs tárolt vízjel) 3 napra nézünk vissza. */
export function defaultWatermark(nowSec: number): number {
  return nowSec - 3 * 86_400
}

/** Az új vízjel a lap legfrissebb eleme — de sosem csökken. */
export function nextWatermark(current: number, media: UpdatedStamp[]): number {
  return media.reduce((max, m) => Math.max(max, m.updatedAt), current)
}
