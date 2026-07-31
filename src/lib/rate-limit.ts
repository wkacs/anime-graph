// Egyszerű fix-ablakos rate-limit az api_cache táblán (nincs külön infra).
// Az IP/e-mail azonosító HMAC-ként kerül a kulcsba: adatbázis-hozzáférésből nem
// olvasható vissza. Az atomi upsert miatt párhuzamos kérés sem lépi túl a keretet.

import { createHmac } from 'node:crypto'
import { db } from '@/db/client'
import { apiCache } from '@/db/schema'
import { sessionSecret } from './env'
import { eq, sql } from 'drizzle-orm'

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0].trim() : null) || headers.get('x-real-ip') || 'local'
}

export function rateLimitKey(scope: string, id: string, secret = sessionSecret()): string {
  const digest = createHmac('sha256', secret)
    .update(`${scope}\0${id}`)
    .digest('hex')
  return `rl:${scope}:${digest}`
}

/** true = mehet; false = limit fölött (429-et adj) */
export async function rateLimit(scope: string, id: string, limit: number, windowSec: number): Promise<boolean> {
  const key = rateLimitKey(scope, id)
  const now = new Date()
  try {
    const [row] = await db.insert(apiCache)
      .values({ key, value: { count: 1 }, expiresAt: new Date(now.getTime() + windowSec * 1000) })
      .onConflictDoUpdate({
        target: apiCache.key,
        set: {
          // lejárt ablak → új ablak 1-ről; élő ablak → számláló +1, expires marad
          value: sql`CASE WHEN ${apiCache.expiresAt} < now()
            THEN jsonb_build_object('count', 1)
            ELSE jsonb_build_object('count', COALESCE((${apiCache.value}->>'count')::int, 0) + 1) END`,
          expiresAt: sql`CASE WHEN ${apiCache.expiresAt} < now()
            THEN ${new Date(now.getTime() + windowSec * 1000)} ELSE ${apiCache.expiresAt} END`,
          updatedAt: now,
        },
      })
      .returning({ value: apiCache.value })
    const count = ((row?.value as { count?: number })?.count) ?? 1
    return count <= limit
  } catch (e) {
    console.error('rate-limit hiba (átengedve):', e)
    return true // a limiter hibája sosem zárhatja ki a valódi usert
  }
}

// takarítás nem kell: az api_cache kulcsok felülíródnak, a lejárt ablak újraindul
export async function clearRateLimit(scope: string, id: string): Promise<void> {
  await db.delete(apiCache).where(eq(apiCache.key, rateLimitKey(scope, id)))
}
