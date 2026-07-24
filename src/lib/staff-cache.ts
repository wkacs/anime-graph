import { getCached, setCached } from './api-cache'
import { fetchStaff, type StaffEntry } from './anilist'

// Címoldali stáb-szekció: AniList staff-query api_cache-en át (TTL 7 nap),
// hogy az ISR-oldal ne verje az AniList-et minden regenerálásnál.
const TTL_SEC = 7 * 24 * 3600
export const STAFF_LIMIT = 6

const ROLE_PRIORITY = ['Director', 'Original Creator', 'Character Design', 'Music', 'Series Composition']

export function prioritizeStaff(entries: StaffEntry[], limit = STAFF_LIMIT): StaffEntry[] {
  const rank = (role: string) => {
    const i = ROLE_PRIORITY.findIndex((p) => role.startsWith(p))
    return i === -1 ? ROLE_PRIORITY.length : i
  }
  const seen = new Set<number>()
  return [...entries]
    .sort((a, b) => rank(a.role) - rank(b.role))
    .filter((e) => !seen.has(e.staffId) && (seen.add(e.staffId), true))
    .slice(0, limit)
}

export async function getCachedStaff(anilistId: number, mediaType: string): Promise<StaffEntry[]> {
  const key = `staff:${mediaType}:${anilistId}`
  const cached = await getCached<StaffEntry[]>(key)
  if (cached) return cached
  try {
    const staff = prioritizeStaff(await fetchStaff(anilistId))
    await setCached(key, staff, TTL_SEC)
    return staff
  } catch {
    // stáb nélkül is él az oldal; a hibát nem cache-eljük, következő regenerálás újrapróbálja
    return []
  }
}
