import { NextRequest, NextResponse } from 'next/server'
import { loadScanEntries, SCAN_ERROR_KEY } from '@/lib/scan-service'
import { compareLists } from '@/lib/compare'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'
import type { ScanEntry } from '@/lib/taste-scan'

export const dynamic = 'force-dynamic'

// „Compare our taste" fiok NELKUL: ket publikus AniList-lista osszevetese.
// Ez a meghivo-hurok masik fele — a /scan magarol mond valamit, ez kettojukrol,
// es epp ezert van oka tovabbkuldeni.
//
// A bejelentkezett /api/compare ettol kulon el: az a sajat, TAROLT listaddal
// dolgozik, es belso felhasznalot is tud celozni. Ez itt kizarolag publikus adat.
const COMPARES_PER_HOUR = 12

const toCompareEntry = (e: ScanEntry) => ({
  anilistId: e.anilistId, title: e.title, coverUrl: e.coverUrl, score: e.score,
})

export async function POST(req: NextRequest) {
  if (!(await rateLimit('duo', clientIp(req.headers), COMPARES_PER_HOUR, 3600))) {
    return apiError('tooManyTries', 429)
  }

  const body = await req.json().catch(() => null)
  const a = String((body as { a?: unknown } | null)?.a ?? '')
  const b = String((body as { b?: unknown } | null)?.b ?? '')
  if (a.toLowerCase() === b.toLowerCase()) return apiError('cannotCompareSelf', 400)

  // Sorosan, nem parhuzamosan: cache-tevesztesnel ket egyidejű nagy lekeres menne
  // ki az AniList fele ugyanabbol a keresbol.
  const first = await loadScanEntries(a)
  if (!first.ok) {
    const { key, status } = SCAN_ERROR_KEY[first.error]
    return apiError(key, status)
  }
  const second = await loadScanEntries(b)
  if (!second.ok) {
    const { key, status } = SCAN_ERROR_KEY[second.error]
    return apiError(key, status)
  }

  // A `compareLists` „mine" oldala a MEGHIVOTT (aki most beirta a nevet): a
  // valasz az o nezopontjabol szol, o all a kepernyo elott.
  const result = compareLists(
    second.entries.map((e) => ({ ...toCompareEntry(e), myScore: e.score })),
    first.entries.map(toCompareEntry),
  )
  return NextResponse.json({ a: first.username, b: second.username, ...result })
}
