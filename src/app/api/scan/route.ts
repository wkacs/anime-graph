import { NextRequest, NextResponse } from 'next/server'
import { fetchUserListForScan } from '@/lib/anilist'
import { scanTaste, isValidAnilistUsername, type ScanEntry } from '@/lib/taste-scan'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// Taste Scan: bejelentkezes NELKUL keszit reszleges izles-terkepet egy publikus
// AniList-listabol. Ez a hidegindito — import es regisztracio nelkul is lassa
// valaki, hogy a termek tud rola valamit.
//
// Publikus vegpont, ami harmadik felhez (AniList) fordul, ezert szigoru:
// alakra szurt felhasznalonev + IP-alapu limit. A limit nem csak minket ved:
// az AniList API-jat sem terhelhetjuk valaki mas neveben korlatlanul.
const SCANS_PER_HOUR = 12

export async function POST(req: NextRequest) {
  if (!(await rateLimit('scan', clientIp(req.headers), SCANS_PER_HOUR, 3600))) {
    return apiError('tooManyTries', 429)
  }

  const body = await req.json().catch(() => null)
  const username = (body as { username?: unknown } | null)?.username
  if (!isValidAnilistUsername(username)) return apiError('usernameRequired', 400)

  let raw
  try {
    raw = await fetchUserListForScan(username, 'ANIME')
  } catch (e) {
    // Nem letezo felhasznalora az AniList 404-et ad. Az elgepelt nev a
    // leggyakoribb eset, ezert azt nem szabad kimaradasnak latszania.
    if ((e as { status?: number }).status === 404) return apiError('noSuchUser', 404)
    return apiError('anilistDown', 502)
  }
  // Privat lista es ures lista kivulrol egyforma; nem talalgatunk.
  if (raw.length === 0) return apiError('emptyOrPrivateList', 404)

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
  if (!result) return apiError('notEnoughData', 422)
  return NextResponse.json({ username, ...result })
}
