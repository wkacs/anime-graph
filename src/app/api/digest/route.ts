import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { currentSeason } from '@/lib/seasonal'
import { glmChat } from '@/lib/glm'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// one personal sentence-or-two for the top of the News page, cached per day
export async function GET() {
  const today = new Date().toISOString().slice(0, 10)

  const cached = await db.select().from(recommendations)
    .where(eq(recommendations.kind, 'digest'))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  if (cached[0] && (cached[0].input as { date?: string }).date === today) {
    return NextResponse.json({ digest: (cached[0].result as { text: string }).text })
  }

  const rows = await db.select().from(anime)
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
    .where(eq(recommendations.kind, 'seasonal'))
    .orderBy(desc(recommendations.createdAt))
    .limit(1)
  const topSeason = seasonal[0] && (seasonal[0].input as { season: string }).season === season.season
    ? ((seasonal[0].result as { items?: { title: string; score: number }[] }).items ?? [])
        .slice(0, 2).map((i) => `${i.title} (${i.score}/100 ízlés-pont)`)
    : []

  const facts = (await db.select().from(tasteMemory).orderBy(desc(tasteMemory.createdAt)).limit(10))
    .map((f) => `(${f.kind}) ${f.text}`)

  const watching = rows.filter((r) => r.status === 'watching').length

  try {
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
    ], { retries: 1 })).trim()
    await db.insert(recommendations).values({
      kind: 'digest',
      input: { date: today },
      result: { text },
    })
    return NextResponse.json({ digest: text })
  } catch {
    return NextResponse.json({ digest: null })
  }
}
