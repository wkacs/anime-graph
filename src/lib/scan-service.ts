import { fetchUserListForScan } from './anilist'
import { scanTaste, isValidAnilistUsername, type ScanEntry, type ScanResult } from './taste-scan'
import { getCached, setCached } from './api-cache'

// A scan ket helyrol fut: a /scan urlaprol es a megoszthato /scan/[username]
// oldalrol. Egy helyen tartva ugyanazt az eredmenyt adjak — kulonben a megosztott
// link mast mutatna, mint amit a megosztoja latott, es az a link ertelmet venne.

export type ScanFailure = 'badUsername' | 'noSuchUser' | 'emptyOrPrivateList' | 'notEnoughData' | 'anilistDown'
export type ScanOutcome =
  | { ok: true; username: string; result: ScanResult; cached: boolean }
  | { ok: false; error: ScanFailure }

/**
 * Cache-elve, mert a megoszthato oldalt sokan nyithatjak meg egyszerre, es egy
 * nagy lista lekerese az AniList API-tol tobb masodperc. A vizjelet a felhasznalonev
 * KISBETUS alakja adja: az AniList a nevet nem kis-nagybetu-erzekenyen kezeli.
 */
const CACHE_TTL_SEC = 6 * 3600
const cacheKey = (username: string) => `scan:v1:${username.toLowerCase()}`

export async function runScan(username: string): Promise<ScanOutcome> {
  if (!isValidAnilistUsername(username)) return { ok: false, error: 'badUsername' }

  const cached = await getCached<ScanResult>(cacheKey(username)).catch(() => null)
  if (cached) return { ok: true, username, result: cached, cached: true }

  let raw
  try {
    raw = await fetchUserListForScan(username, 'ANIME')
  } catch (e) {
    // Nem letezo felhasznalora az AniList 404-et ad. Az elgepelt nev a leggyakoribb
    // eset, ezert azt nem szabad kimaradasnak latszania.
    if ((e as { status?: number }).status === 404) return { ok: false, error: 'noSuchUser' }
    return { ok: false, error: 'anilistDown' }
  }
  // Privat lista es ures lista kivulrol egyforma; nem talalgatunk.
  if (raw.length === 0) return { ok: false, error: 'emptyOrPrivateList' }

  const entries: ScanEntry[] = raw
    .filter((e) => !e.media.isAdult)
    .map((e) => ({
      anilistId: e.media.id,
      title: e.media.title.english ?? e.media.title.romaji,
      coverUrl: e.media.coverImage?.large ?? null,
      status: e.status,
      score: e.score,
      genres: e.media.genres ?? [],
      tags: e.media.tags ?? [],
      studio: e.media.studios?.nodes?.[0]?.name ?? null,
      year: e.media.seasonYear,
      averageScore: e.media.averageScore,
      popularity: e.media.popularity,
    }))

  const result = scanTaste(entries)
  if (!result) return { ok: false, error: 'notEnoughData' }

  // A cache-iras hibaja nem bukhatja meg a scant — a valasz mar keszen all.
  await setCached(cacheKey(username), result, CACHE_TTL_SEC).catch(() => {})
  return { ok: true, username, result, cached: false }
}

/** A hiba-kulcsok a kozos `apiErrors` nevterbol jonnek. */
export const SCAN_ERROR_KEY: Record<ScanFailure, { key: string; status: number }> = {
  badUsername: { key: 'usernameRequired', status: 400 },
  noSuchUser: { key: 'noSuchUser', status: 404 },
  emptyOrPrivateList: { key: 'emptyOrPrivateList', status: 404 },
  notEnoughData: { key: 'notEnoughData', status: 422 },
  anilistDown: { key: 'anilistDown', status: 502 },
}
