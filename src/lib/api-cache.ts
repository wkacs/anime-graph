import { eq } from 'drizzle-orm'
// dbStatic: az api_cache-et az ISR-elt katalógus-címoldal is olvassa (stáb-szekció),
// ott a no-store kliens DYNAMIC_SERVER_USAGE-dzsel 500-at dobna. A frissesség-aggály
// itt nem él: a cache-sorok maguk hordják a TTL-t (expires_at).
import { dbStatic as db } from '@/db/client'
import { apiCache } from '@/db/schema'

export function isFresh(expiresAt: Date | null, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() > now.getTime()
}

export async function getCached<T>(key: string): Promise<T | null> {
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key))
  if (!row || !isFresh(row.expiresAt, new Date())) return null
  return row.value as T
}

export async function setCached(key: string, value: unknown, ttlSec: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSec * 1000)
  await db.insert(apiCache).values({ key, value, expiresAt, updatedAt: new Date() })
    .onConflictDoUpdate({ target: apiCache.key, set: { value, expiresAt, updatedAt: new Date() } })
}
