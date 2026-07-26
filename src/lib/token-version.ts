import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'

// Process-memóriás cache: a token_version ellenőrzése ne jelentsen adatbázis-kört
// minden kérésen (51 route hívja a requireUserId-t). Ára: egy érvénytelenített
// session legfeljebb TTL_MS-ig még él — vállalt kompromisszum.
const TTL_MS = 60_000

type Entry = { version: number; at: number }
export const __cacheForTest = new Map<number, Entry>()

export function isCacheFresh(entry: Entry, now = Date.now()): boolean {
  return now - entry.at < TTL_MS
}

/** jelszó-reset után hívandó, hogy a váltás azonnal érvényesüljön ebben a processzben */
export function clearTokenVersionCache(userId?: number): void {
  if (userId == null) __cacheForTest.clear()
  else __cacheForTest.delete(userId)
}

export async function currentTokenVersion(userId: number): Promise<number> {
  const hit = __cacheForTest.get(userId)
  if (hit && isCacheFresh(hit)) return hit.version
  const [row] = await db.select({ v: users.tokenVersion }).from(users).where(eq(users.id, userId))
  const version = row?.v ?? 0
  __cacheForTest.set(userId, { version, at: Date.now() })
  return version
}
