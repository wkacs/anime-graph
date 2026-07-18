import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// daily Vercel cron: e-mail about followed anime airing in the next 24h.
// Needs RESEND_API_KEY + NOTIFY_EMAIL; without them it no-ops quietly.
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    return NextResponse.json({ skipped: 'RESEND_API_KEY / NOTIFY_EMAIL nincs beállítva' })
  }

  // értesítés csak az owner-fióknak (user_id=1) — a többi fióknak nincs e-mailje
  const rows = await db.select().from(anime).where(eq(anime.userId, 1))
  const followed = rows.filter((r) => r.status === 'watching' || r.status === 'planned')
  if (!followed.length) return NextResponse.json({ sent: false, reason: 'nincs követett anime' })

  const airing = await fetchAiringFor(followed.map((r) => r.anilistId))
  const titleByAnilist = new Map(rows.map((r) => [r.anilistId, r.titleRomaji]))
  const nowSec = Math.floor(Date.now() / 1000)
  const today = airing
    .filter((a) => a.airingAt - nowSec < 24 * 3600 && a.airingAt > nowSec - 3600)
    .sort((a, b) => a.airingAt - b.airingAt)

  if (!today.length) return NextResponse.json({ sent: false, reason: 'ma nincs új rész' })

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

  if (!res.ok) {
    return NextResponse.json({ sent: false, error: `Resend HTTP ${res.status}` }, { status: 502 })
  }
  return NextResponse.json({ sent: true, count: today.length })
}
