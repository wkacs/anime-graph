import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { db } from '@/db/client'
import { anime, notifiedAiring, pushSubscriptions } from '@/db/schema'
import { fetchAiringFor, type AiringInfo } from '@/lib/anilist'
import { buildAiringPayload, pickUpcoming } from '@/lib/push'
import { authorizeCron } from '@/lib/cron-auth'
import { eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// óránkénti hívás (GitHub Actions): push a köv. 70 percben adásba kerülő részekről,
// (anilistId, episode) dedup a notified_airing táblán.
// ?mode=email (napi Vercel-cron): a napi e-mail digest az ownernek (user_id=1).
export async function GET(req: NextRequest) {
  const auth = authorizeCron(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (auth === 'misconfigured') return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  if (auth === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(anime).where(eq(anime.mediaType, 'ANIME'))
  const followed = rows.filter((r) => r.status === 'watching' || r.status === 'planned')
  if (!followed.length) return NextResponse.json({ sent: 0, reason: 'nincs követett anime' })
  const airing = await fetchAiringFor([...new Set(followed.map((r) => r.anilistId))])

  if (req.nextUrl.searchParams.get('mode') === 'email') {
    return NextResponse.json(await sendDailyEmail(followed, airing))
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ skipped: 'VAPID kulcsok nincsenek beállítva' })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const nowSec = Math.floor(Date.now() / 1000)
  const upcoming = pickUpcoming(airing, nowSec, 70)
  if (!upcoming.length) return NextResponse.json({ sent: 0, reason: 'nincs közelgő rész' })

  const subs = await db.select().from(pushSubscriptions)
  const subsByUser = new Map<number, typeof subs>()
  for (const s of subs) {
    const list = subsByUser.get(s.userId) ?? []
    list.push(s)
    subsByUser.set(s.userId, list)
  }

  let sent = 0
  const dead: string[] = []
  for (const a of upcoming) {
    // globális dedup: az első futás, ami látja, az értesít mindenkit
    const inserted = await db.insert(notifiedAiring)
      .values({ anilistId: a.anilistId, episode: a.nextEpisode })
      .onConflictDoNothing()
      .returning()
    if (!inserted.length) continue
    const followers = followed.filter((r) => r.anilistId === a.anilistId)
    for (const f of followers) {
      const payload = JSON.stringify(buildAiringPayload(f.titleRomaji, a.nextEpisode))
      for (const s of subsByUser.get(f.userId) ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) dead.push(s.endpoint)
        }
      }
    }
  }
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead))
  return NextResponse.json({ sent, episodes: upcoming.length, removedSubs: dead.length })
}

type FollowedRow = { userId: number; anilistId: number; titleRomaji: string }

// a korábbi napi owner-email logika, változatlan viselkedéssel
async function sendDailyEmail(followed: FollowedRow[], airing: AiringInfo[]) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    return { skipped: 'RESEND_API_KEY / NOTIFY_EMAIL nincs beállítva' }
  }
  // értesítés csak az owner-fióknak (user_id=1) — a többi fióknak nincs e-mailje
  const ownerFollowed = followed.filter((r) => r.userId === 1)
  const ownerIds = new Set(ownerFollowed.map((r) => r.anilistId))
  const titleByAnilist = new Map(ownerFollowed.map((r) => [r.anilistId, r.titleRomaji]))
  const nowSec = Math.floor(Date.now() / 1000)
  const today = airing
    .filter((a) => ownerIds.has(a.anilistId) && a.airingAt - nowSec < 24 * 3600 && a.airingAt > nowSec - 3600)
    .sort((a, b) => a.airingAt - b.airingAt)
  if (!today.length) return { sent: false, reason: 'ma nincs új rész' }

  const items = today.map((a) => {
    const time = new Date(a.airingAt * 1000).toLocaleTimeString('hu-HU', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest',
    })
    return `<li style="margin-bottom:6px"><strong>${titleByAnilist.get(a.anilistId)}</strong> — EP ${a.nextEpisode} · ${time}</li>`
  }).join('')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL ?? 'Anime Graph <onboarding@resend.dev>',
      to: process.env.NOTIFY_EMAIL,
      subject: `📺 Ma ${today.length} követett animéd kap új részt`,
      html: `<div style="font-family:sans-serif;color:#111">
        <p>Ma érkező részek:</p>
        <ul style="padding-left:18px">${items}</ul>
        <p style="color:#888;font-size:12px">anime graph · napi értesítő</p>
      </div>`,
    }),
  })

  if (!res.ok) return { sent: false, error: `Resend HTTP ${res.status}` }
  return { sent: true, count: today.length }
}
