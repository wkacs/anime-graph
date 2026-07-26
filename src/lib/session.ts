import { cookies } from 'next/headers'
import { verifySession } from './auth'
import { currentTokenVersion } from './token-version'

// route-oldali helper: a bejelentkezett user id-ja vagy null.
// A token_version egyeztetése miatt a jelszó-reset kilépteti a többi eszközt —
// a middleware ezt szándékosan NEM nézi (edge-en nincs adatbázis-olvasás).
export async function requireUserId(): Promise<number | null> {
  const token = (await cookies()).get('session')?.value
  const claims = await verifySession(process.env.SESSION_SECRET!, token)
  if (!claims) return null
  if ((await currentTokenVersion(claims.userId)) !== claims.tokenVersion) return null
  return claims.userId
}
