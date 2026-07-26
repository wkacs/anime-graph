import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { userLocale } from '@/lib/user-locale'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { currentSeason, seasonScoreKind } from '@/lib/seasonal'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { glmChat } from '@/lib/glm'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// one personal sentence-or-two for the top of the News page, cached per day
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const today = new Date().toISOString().slice(0, 10)
  const locale = await userLocale(userId)

  const cached = await db.select().from(recommendations)
    .where(and(eq(recommendations.kind, aiCacheKind('digest', locale)), eq(recommendations.userId, userId)))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  if (cached[0] && (cached[0].input as { date?: string }).date === today) {
    return NextResponse.json({ digest: (cached[0].result as { text: string }).text })
  }

  const rows = await db.select().from(anime).where(eq(anime.userId, userId))
  if (!rows.length) return NextResponse.json({ digest: null })

  const followed = rows.filter((r) => r.status === 'watching' || r.status === 'planned')
  const airing = followed.length
    ? await fetchAiringFor(followed.map((r) => r.anilistId)).catch(() => [])
    : []
  const titleByAnilist = new Map(rows.map((r) => [r.anilistId, r.titleRomaji]))
  const weekAiring = airing
    .filter((a) => a.airingAt * 1000 - Date.now() < 7 * 86400_000)
    .map((a) => `${titleByAnilist.get(a.anilistId)} (EP${a.nextEpisode}, ${Math.max(0, Math.round((a.airingAt * 1000 - Date.now()) / 86400_000))} nap)`)

  const season = currentSeason(new Date())
  const seasonal = await db.select().from(recommendations)
    .where(and(eq(recommendations.kind, aiCacheKind(seasonScoreKind(season), locale)), eq(recommendations.userId, userId)))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  // a kulcs már szezon-specifikus, külön input-ellenőrzés nem kell
  const topSeason = ((seasonal[0]?.result as { items?: { title: string; score: number }[] } | undefined)?.items ?? [])
    .slice(0, 2).map((i) => `${i.title} (${i.score}/100 ízlés-pont)`)

  const facts = (await db.select().from(tasteMemory)
    .where(eq(tasteMemory.userId, userId))
    .orderBy(desc(tasteMemory.createdAt)).limit(10))
    .map((f) => `(${f.kind}) ${f.text}`)

  const watching = rows.filter((r) => r.status === 'watching').length

  try {
    await consumeAiQuota(userId, 'digest')
    const text = (await glmChat([
      {
        role: 'system',
        content: 'Anime-asszisztens vagy. Írj LEGFELJEBB két rövid, személyes hangú magyar mondatot a felhasználó hetéről az adatok alapján. Semmi felsorolás, semmi emoji-halmozás, max egy emoji. Csak a szöveget add vissza.',
      },
      {
        role: 'user',
        content:
          `Éppen nézett sorozataim száma: ${watching}\n` +
          `A héten új részt kap: ${weekAiring.join('; ') || 'semmi'}\n` +
          `A szezonból nekem ajánlott: ${topSeason.join('; ') || 'nincs pontozva'}\n` +
          `Friss ízlés-tényeim: ${facts.slice(0, 5).join('; ') || 'nincs'}`,
      },
    ], { retries: 1, userId, endpoint: 'digest' })).trim()
    await db.insert(recommendations).values({
      userId,
      kind: aiCacheKind('digest', locale),
      input: { date: today },
      result: { text },
    })
    return NextResponse.json({ digest: text })
  } catch {
    return NextResponse.json({ digest: null })
  }
}
