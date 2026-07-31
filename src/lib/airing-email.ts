import type { AiringInfo } from './anilist'
import { escapeHtml, sendEmail } from './email'

export type FollowedAiringRow = {
  userId: number
  anilistId: number
  titleRomaji: string
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Budapest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function buildDailyAiringEmail(
  followed: FollowedAiringRow[],
  airing: AiringInfo[],
  now = new Date(),
) {
  const ownerFollowed = followed.filter((row) => row.userId === 1)
  const ownerIds = new Set(ownerFollowed.map((row) => row.anilistId))
  const titleByAnilist = new Map(ownerFollowed.map((row) => [row.anilistId, row.titleRomaji]))
  const nowSec = Math.floor(now.getTime() / 1000)
  const today = airing
    .filter((row) => (
      ownerIds.has(row.anilistId)
      && row.airingAt > nowSec - 3600
      && row.airingAt < nowSec + 24 * 3600
    ))
    .sort((a, b) => a.airingAt - b.airingAt)
  if (!today.length) return null

  const rows = today.map((row) => {
    const title = titleByAnilist.get(row.anilistId) ?? `AniList #${row.anilistId}`
    const time = new Date(row.airingAt * 1000).toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Budapest',
    })
    return {
      title,
      episode: row.nextEpisode,
      time,
    }
  })
  const htmlItems = rows.map((row) =>
    `<li style="margin-bottom:6px"><strong>${escapeHtml(row.title)}</strong> — EP ${row.episode} · ${escapeHtml(row.time)}</li>`,
  ).join('')
  const textItems = rows.map((row) => `${row.title} — EP ${row.episode} · ${row.time}`).join('\n')
  return {
    count: rows.length,
    subject: `📺 Ma ${rows.length} követett animéd kap új részt`,
    html: `<div style="font-family:system-ui,sans-serif;color:#111">
<p>Ma érkező részek:</p>
<ul style="padding-left:18px">${htmlItems}</ul>
<p style="color:#888;font-size:12px">Anime Graph · napi értesítő</p>
</div>`,
    text: `Ma érkező részek:\n\n${textItems}\n\nAnime Graph · napi értesítő`,
    idempotencyKey: `airing-digest-${DAY_FORMAT.format(now)}`,
  }
}

export async function sendDailyAiringEmail(
  followed: FollowedAiringRow[],
  airing: AiringInfo[],
  now = new Date(),
) {
  const to = process.env.NOTIFY_EMAIL?.trim()
  if (!to) return { status: 'skipped' as const, reason: 'NOTIFY_EMAIL nincs beállítva' }
  const message = buildDailyAiringEmail(followed, airing, now)
  if (!message) return { status: 'skipped' as const, reason: 'ma nincs új rész' }
  const delivery = await sendEmail(to, message.subject, message.html, {
    text: message.text,
    idempotencyKey: message.idempotencyKey,
    tag: 'airing-digest',
  })
  return delivery.sent
    ? { status: 'sent' as const, count: message.count, emailId: delivery.id }
    : { status: 'failed' as const, reason: delivery.reason, upstreamStatus: delivery.status }
}

