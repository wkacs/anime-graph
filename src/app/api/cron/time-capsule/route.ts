import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { db } from '@/db/client'
import { anime, pushSubscriptions, title } from '@/db/schema'
import { anniversaryYears, buildCapsulePayload } from '@/lib/time-capsule'
import { eq, inArray, isNotNull, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Időkapszula (D8): napi cron — „N éve ma fejezted be" push az évfordulós címekről.
// Dedup nem kell: naptári évforduló + napi egyszeri futás önmagában egyedi.
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
  if (!anniversaries.length) return NextResponse.json({ sent: 0, reason: 'nincs mai évforduló' })

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
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead))
  return NextResponse.json({ sent, anniversaries: anniversaries.length, removedSubs: dead.length })
}
