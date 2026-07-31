import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, pushSubscriptions, title } from '@/db/schema'
import { anniversaryYears, buildCapsulePayload } from '@/lib/time-capsule'
import { buildSeasonPayload, seasonStartInfo } from '@/lib/season-push'
import { authorizeCron } from '@/lib/cron-auth'
import { sendPushOnce, type PushDeliveryResult } from '@/lib/push-delivery'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = authorizeCron(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (auth === 'misconfigured') return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  if (auth === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ skipped: 'VAPID kulcsok nincsenek beállítva' })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const rows = await db.select({
    userId: anime.userId,
    titleRomaji: anime.titleRomaji,
    watchedAt: anime.watchedAt,
    mediaType: anime.mediaType,
    slug: title.slug,
  }).from(anime)
    .innerJoin(title, eq(title.id, anime.titleId))
    .where(and(
      eq(anime.status, 'completed'),
      isNotNull(anime.watchedAt),
      eq(title.isAdult, 0),
    ))

  const now = new Date()
  const anniversaries = rows
    .map((row) => ({ ...row, years: anniversaryYears(row.watchedAt!, now) }))
    .filter((row): row is typeof row & { years: number } => row.years != null)

  const subs = await db.select().from(pushSubscriptions)
  const subsByUser = new Map<number, typeof subs>()
  for (const subscription of subs) {
    const list = subsByUser.get(subscription.userId) ?? []
    list.push(subscription)
    subsByUser.set(subscription.userId, list)
  }

  let sent = 0
  let seasonSent = 0
  let failed = 0
  let pending = 0
  const dead = new Set<string>()

  const recordResult = (
    result: PushDeliveryResult,
    endpoint: string,
    season: boolean,
  ) => {
    if (result.state === 'sent') {
      if (season) seasonSent++
      else sent++
    }
    if (result.state === 'dead') dead.add(endpoint)
    if (result.state === 'failed') {
      failed++
      console.error('Időkapszula push kézbesítési hiba:', { status: result.statusCode })
    }
    if (result.state === 'pending') pending++
  }

  for (const anniversary of anniversaries) {
    const path = anniversary.mediaType === 'MANGA'
      ? `/manga/${anniversary.slug}`
      : `/anime/${anniversary.slug}`
    const payload = JSON.stringify(buildCapsulePayload(
      anniversary.titleRomaji,
      anniversary.years,
      path,
    ))
    for (const subscription of subsByUser.get(anniversary.userId) ?? []) {
      const result = await sendPushOnce({
        eventKey: `anniversary:${anniversary.userId}:${anniversary.slug}:${anniversary.years}`,
        subscription,
        payload,
        ttlDays: 400,
      })
      recordResult(result, subscription.endpoint, false)
    }
  }

  const seasonInfo = seasonStartInfo(now)
  if (seasonInfo) {
    const payload = JSON.stringify(buildSeasonPayload(seasonInfo.year, seasonInfo.season))
    for (const [userId, userSubs] of subsByUser) {
      for (const subscription of userSubs) {
        const result = await sendPushOnce({
          eventKey: `season:${seasonInfo.year}:${seasonInfo.season}:${userId}`,
          subscription,
          payload,
          ttlDays: 180,
        })
        recordResult(result, subscription.endpoint, true)
      }
    }
  }

  if (dead.size) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, [...dead]))
  }
  const status = failed > 0 ? 502 : pending > 0 ? 503 : 200
  return NextResponse.json({
    sent,
    anniversaries: anniversaries.length,
    seasonSent,
    failed,
    pending,
    removedSubs: dead.size,
  }, { status })
}
