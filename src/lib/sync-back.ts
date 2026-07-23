// Kétirányú szinkron — visszaírás (D3): a nálunk történt lista-változás (státusz/
// progressz/pont) best-effort kimegy a bekötött MAL/AniList fiókba. Hiba SOHA nem
// töri meg a saját mentést: minden provider-hívás try/catch + console.error.
// v1-hatókör: ANIME státusz/progressz/pont. Törlés és manga visszaírás később.

import { db } from '@/db/client'
import { syncAccounts, title } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export type ListChange = {
  malId: number | null
  anilistId: number
  mediaType: string
  status?: string
  progress?: number
  myScore?: number | null
}

export const toMalStatus: Record<string, string> = {
  watching: 'watching', completed: 'completed', planned: 'plan_to_watch', dropped: 'dropped',
}
export const toAniListStatus: Record<string, string> = {
  watching: 'CURRENT', completed: 'COMPLETED', planned: 'PLANNING', dropped: 'DROPPED',
}

export function buildMalBody(change: ListChange): Record<string, string> {
  const body: Record<string, string> = {}
  if (change.status && toMalStatus[change.status]) body.status = toMalStatus[change.status]
  if (change.progress !== undefined) body.num_watched_episodes = String(change.progress)
  if (change.myScore !== undefined) body.score = String(change.myScore ?? 0)
  return body
}

export function buildAniListMutation(change: ListChange): { query: string; variables: Record<string, unknown> } | null {
  const sets: string[] = []
  const variables: Record<string, unknown> = { mediaId: change.anilistId }
  if (change.status && toAniListStatus[change.status]) {
    sets.push('status: $status')
    variables.status = toAniListStatus[change.status]
  }
  if (change.progress !== undefined) {
    sets.push('progress: $progress')
    variables.progress = change.progress
  }
  if (change.myScore !== undefined) {
    sets.push('scoreRaw: $scoreRaw')
    variables.scoreRaw = (change.myScore ?? 0) * 10
  }
  if (!sets.length) return null
  const params = ['$mediaId: Int']
  if (variables.status !== undefined) params.push('$status: MediaListStatus')
  if (variables.progress !== undefined) params.push('$progress: Int')
  if (variables.scoreRaw !== undefined) params.push('$scoreRaw: Int')
  return {
    query: `mutation(${params.join(', ')}){SaveMediaListEntry(mediaId: $mediaId, ${sets.join(', ')}){id}}`,
    variables,
  }
}

async function freshMalToken(account: typeof syncAccounts.$inferSelect): Promise<string | null> {
  const soon = Date.now() + 60_000
  if (!account.expiresAt || account.expiresAt.getTime() > soon) return account.accessToken
  if (!account.refreshToken || !process.env.MAL_CLIENT_ID) return null
  const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MAL_CLIENT_ID,
      client_secret: process.env.MAL_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    }),
  })
  if (!res.ok) return null
  const j = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
  await db.update(syncAccounts).set({
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: new Date(Date.now() + j.expires_in * 1000),
  }).where(eq(syncAccounts.id, account.id))
  return j.access_token
}

async function pushMal(account: typeof syncAccounts.$inferSelect, change: ListChange) {
  if (change.malId == null || change.mediaType === 'MANGA') return
  const body = buildMalBody(change)
  if (!Object.keys(body).length) return
  const token = await freshMalToken(account)
  if (!token) return
  const res = await fetch(`https://api.myanimelist.net/v2/anime/${change.malId}/my_list_status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  if (!res.ok) console.error(`sync-back MAL ${change.malId}: HTTP ${res.status}`)
}

async function pushAniList(account: typeof syncAccounts.$inferSelect, change: ListChange) {
  const mutation = buildAniListMutation(change)
  if (!mutation) return
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mutation),
  })
  if (!res.ok) console.error(`sync-back AniList ${change.anilistId}: HTTP ${res.status}`)
}

// Kényelmi belépő az API-routeoknak: view-sorból + részváltozásból teljes ListChange.
// Ha nincs bekötött fiók, egyetlen SELECT-tel kiszáll — a title-lookup is megspórolódik.
export async function pushRowChange(
  userId: number,
  row: { titleId: number; anilistId: number; mediaType: string },
  change: Pick<ListChange, 'status' | 'progress' | 'myScore'>,
): Promise<void> {
  try {
    const accounts = await db.select().from(syncAccounts).where(eq(syncAccounts.userId, userId))
    if (!accounts.length) return
    const [t] = await db.select({ malId: title.malId }).from(title).where(eq(title.id, row.titleId))
    await pushToProviders(userId, {
      malId: t?.malId ?? null, anilistId: row.anilistId, mediaType: row.mediaType, ...change,
    }, accounts)
  } catch (e) {
    console.error('sync-back pushRowChange hiba:', e)
  }
}

// best-effort: hívd await-tel, de a hívó válaszát sosem buktatja el
export async function pushToProviders(
  userId: number,
  change: ListChange,
  preloaded?: (typeof syncAccounts.$inferSelect)[],
): Promise<void> {
  try {
    const accounts = preloaded
      ?? await db.select().from(syncAccounts).where(and(eq(syncAccounts.userId, userId)))
    for (const acc of accounts) {
      try {
        if (acc.provider === 'mal') await pushMal(acc, change)
        else if (acc.provider === 'anilist') await pushAniList(acc, change)
      } catch (e) {
        console.error(`sync-back ${acc.provider} hiba:`, e)
      }
    }
  } catch (e) {
    console.error('sync-back: fiókok betöltése sikertelen:', e)
  }
}
