import { fetchUserListForScan } from './anilist'
import { scanTaste, isValidAnilistUsername, type ScanEntry, type ScanResult } from './taste-scan'
import { getCached, setCached } from './api-cache'

// A publikus AniList-lista harom helyrol kell: a /scan urlaprol, a megoszthato
// /scan/[username] oldalrol es a /duo osszehasonlitasbol. Egy betolteson keresztul
// megy mind — kulonben ugyanarrol a listarol harom kulon lekeres menne ki az
// AniListhez, es a megosztott link mast mutathatna, mint amit a megosztoja latott.

export type ScanFailure = 'badUsername' | 'noSuchUser' | 'emptyOrPrivateList' | 'notEnoughData' | 'anilistDown'
export type EntriesOutcome =
  | { ok: true; username: string; entries: ScanEntry[] }
  | { ok: false; error: ScanFailure }
export type ScanOutcome =
  | { ok: true; username: string; result: ScanResult }
  | { ok: false; error: ScanFailure }

/**
 * Cache-elve, mert a megoszthato oldalt sokan nyithatjak meg egyszerre, es egy
 * nagy lista lekerese az AniList API-tol tobb masodperc. A kulcsot a felhasznalonev
 * KISBETUS alakja adja: az AniList a nevet nem kis-nagybetu-erzekenyen kezeli.
 */
const ENTRIES_TTL_SEC = 6 * 3600
const entriesKey = (username: string) => `scan:entries:v1:${username.toLowerCase()}`

/**
 * A gyengen jelolt tagek mar a terkepesites soran kiesnek. Egyetlen fogyasztojuk
 * a szignatura-szamitas, az pedig ugyanezt a kuszobot alkalmazza — viszont egy
 * cimhez az AniList harminc-egynehany taget ad, tehat cache-elve ez a szures
 * a tarolt sor tobbszoroset sporolja.
 */
const KEPT_TAG_RANK = 60

export async function loadScanEntries(username: string): Promise<EntriesOutcome> {
  if (!isValidAnilistUsername(username)) return { ok: false, error: 'badUsername' }

  const cached = await getCached<ScanEntry[]>(entriesKey(username)).catch(() => null)
  if (cached?.length) return { ok: true, username, entries: cached }

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
      tags: (e.media.tags ?? []).filter((t) => t.rank >= KEPT_TAG_RANK),
      studio: e.media.studios?.nodes?.[0]?.name ?? null,
      year: e.media.seasonYear,
      averageScore: e.media.averageScore,
      popularity: e.media.popularity,
    }))

  // A cache-iras hibaja nem bukhatja meg a kerest — a valasz mar keszen all.
  await setCached(entriesKey(username), entries, ENTRIES_TTL_SEC).catch(() => {})
  return { ok: true, username, entries }
}

export async function runScan(username: string): Promise<ScanOutcome> {
  const loaded = await loadScanEntries(username)
  if (!loaded.ok) return loaded
  const result = scanTaste(loaded.entries)
  if (!result) return { ok: false, error: 'notEnoughData' }
  return { ok: true, username: loaded.username, result }
}

/** A hiba-kulcsok a kozos `apiErrors` nevterbol jonnek. */
export const SCAN_ERROR_KEY: Record<ScanFailure, { key: string; status: number }> = {
  badUsername: { key: 'usernameRequired', status: 400 },
  noSuchUser: { key: 'noSuchUser', status: 404 },
  emptyOrPrivateList: { key: 'emptyOrPrivateList', status: 404 },
  notEnoughData: { key: 'notEnoughData', status: 422 },
  anilistDown: { key: 'anilistDown', status: 502 },
}
