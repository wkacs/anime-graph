import { NextRequest, NextResponse } from 'next/server'
import { runScan, SCAN_ERROR_KEY } from '@/lib/scan-service'
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
  const outcome = await runScan(typeof username === 'string' ? username : '')
  if (!outcome.ok) {
    const { key, status } = SCAN_ERROR_KEY[outcome.error]
    return apiError(key, status)
  }
  return NextResponse.json({ username: outcome.username, ...outcome.result })
}
