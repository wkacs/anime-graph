import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { db } from '@/db/client'
import { anime, apiCache, pushSubscriptions, title } from '@/db/schema'
import { anniversaryYears, buildCapsulePayload } from '@/lib/time-capsule'
import { seasonStartInfo, buildSeasonPayload } from '@/lib/season-push'
import { eq, inArray, isNotNull, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Napi push-cron (Vercel Hobby max 2 cron → egy route, két feladat):
// 1) Időkapszula (D8): „N éve ma fejezted be" az évfordulós címekről (dedup: napi 1 futás).
// 2) Szezonváltás: az új szezon első napjaiban egyszeri „nézd meg, mik valók neked"
//    (dedup: api_cache kulcs userenként+szezononként).
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ skipped: 'VAPID kulcsok nincsenek beállítva' })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const rows = await db.select({
    userId: anime.userId, titleRomaji: anime.titleRomaji, watchedAt: anime.watchedAt,
    mediaType: anime.mediaType, slug: title.slug,
  }).from(anime)
    .innerJoin(title, eq(title.id, anime.titleId))
    .where(and(eq(anime.status, 'completed'), isNotNull(anime.watchedAt)))

  const now = new Date()
  const anniversaries = rows
    .map((r) => ({ ...r, years: anniversaryYears(r.watchedAt!, now) }))
    .filter((r): r is typeof r & { years: number } => r.years != null)

  const subs = await db.select().from(pushSubscriptions)
  const subsByUser = new Map<number, typeof subs>()
  for (const s of subs) {
    const list = subsByUser.get(s.userId) ?? []
    list.push(s)
    subsByUser.set(s.userId, list)
  }

  let sent = 0
  const dead: string[] = []
  for (const a of anniversaries) {
    const path = a.slug ? (a.mediaType === 'MANGA' ? `/manga/${a.slug}` : `/anime/${a.slug}`) : null
    const payload = JSON.stringify(buildCapsulePayload(a.titleRomaji, a.years, path))
    for (const s of subsByUser.get(a.userId) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(s.endpoint)
      }
    }
  }
  // 2) szezonváltás-push az ablakban, userenként+szezononként egyszer
  let seasonSent = 0
  const seasonInfo = seasonStartInfo(now)
  if (seasonInfo) {
    const payload = JSON.stringify(buildSeasonPayload(seasonInfo.year, seasonInfo.season))
    for (const [uid, userSubs] of subsByUser) {
      const dedupKey = `season-push:${seasonInfo.year}-${seasonInfo.season}:${uid}`
      const inserted = await db.insert(apiCache)
        .values({ key: dedupKey, value: { sent: true }, expiresAt: new Date(now.getTime() + 30 * 86400_000) })
        .onConflictDoNothing()
        .returning({ key: apiCache.key })
      if (!inserted.length) continue
      for (const s of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          seasonSent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) dead.push(s.endpoint)
        }
      }
    }
  }

  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, [...new Set(dead)]))
  return NextResponse.json({ sent, anniversaries: anniversaries.length, seasonSent, removedSubs: dead.length })
}
