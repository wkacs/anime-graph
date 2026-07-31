import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, notifiedAiring, pushSubscriptions } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { buildAiringPayload, pickUpcoming } from '@/lib/push'
import { authorizeCron } from '@/lib/cron-auth'
import { sendPushOnce } from '@/lib/push-delivery'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Óránkénti GitHub Actions cron. A globális epizód-dedup csak azután készül el,
// hogy minden címzett sikeres, halott vagy korábban már kézbesített állapotba jutott.
export async function GET(req: NextRequest) {
  const auth = authorizeCron(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (auth === 'misconfigured') return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  if (auth === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rows = await db.select().from(anime).where(eq(anime.mediaType, 'ANIME'))
  const followed = rows.filter((row) => row.status === 'watching' || row.status === 'planned')
  if (!followed.length) return NextResponse.json({ sent: 0, reason: 'nincs követett anime' })

  const airing = await fetchAiringFor([...new Set(followed.map((row) => row.anilistId))])
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ skipped: 'VAPID kulcsok nincsenek beállítva' })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const upcoming = pickUpcoming(airing, Math.floor(Date.now() / 1000), 70)
  if (!upcoming.length) return NextResponse.json({ sent: 0, reason: 'nincs közelgő rész' })

  const subs = await db.select().from(pushSubscriptions)
  const subsByUser = new Map<number, typeof subs>()
  for (const subscription of subs) {
    const list = subsByUser.get(subscription.userId) ?? []
    list.push(subscription)
    subsByUser.set(subscription.userId, list)
  }

  let sent = 0
  let failed = 0
  let pending = 0
  let completedEpisodes = 0
  const dead = new Set<string>()

  for (const item of upcoming) {
    const [alreadyDone] = await db.select({ id: notifiedAiring.id }).from(notifiedAiring)
      .where(and(
        eq(notifiedAiring.anilistId, item.anilistId),
        eq(notifiedAiring.episode, item.nextEpisode),
      ))
    if (alreadyDone) continue

    let episodeIncomplete = false
    const followers = followed.filter((row) => row.anilistId === item.anilistId)
    for (const follower of followers) {
      const payload = JSON.stringify(buildAiringPayload(follower.titleRomaji, item.nextEpisode))
      for (const subscription of subsByUser.get(follower.userId) ?? []) {
        const result = await sendPushOnce({
          eventKey: `airing:${item.anilistId}:${item.nextEpisode}`,
          subscription,
          payload,
          ttlDays: 14,
        })
        if (result.state === 'sent') sent++
        if (result.state === 'dead') dead.add(subscription.endpoint)
        if (result.state === 'failed') {
          failed++
          episodeIncomplete = true
          console.error('Airing push kézbesítési hiba:', { status: result.statusCode })
        }
        if (result.state === 'pending') {
          pending++
          episodeIncomplete = true
        }
      }
    }

    if (!episodeIncomplete) {
      await db.insert(notifiedAiring)
        .values({ anilistId: item.anilistId, episode: item.nextEpisode })
        .onConflictDoNothing()
      completedEpisodes++
    }
  }

  if (dead.size) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, [...dead]))
  }
  const status = failed > 0 ? 502 : pending > 0 ? 503 : 200
  return NextResponse.json({
    sent,
    completedEpisodes,
    failed,
    pending,
    removedSubs: dead.size,
  }, { status })
}
