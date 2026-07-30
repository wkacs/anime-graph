import { NextResponse } from 'next/server'
import { serverT } from './server-i18n'

// Lokalizált API-hiba a kérés nyelvén. A kliens a `error` mezőt közvetlenül
// jeleníti meg, ezért itt kell emberi nyelvű szövegnek születnie.
// 🔴 A serverT dinamikus API-t használ — ISR-elt modulból tilos (lásd server-i18n.ts).
export async function apiError(
  key: string,
  status: number,
  params?: Record<string, string | number>,
): Promise<NextResponse> {
  const t = await serverT('apiErrors')
  return NextResponse.json({ error: t(key, params) }, { status })
}
