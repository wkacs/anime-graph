import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions } from '@/db/schema'
import { consumeAiQuota } from '@/lib/ai-quota'
import { glmChat } from '@/lib/glm'
import { buildNlMessages, parseNlResult, type NlItem } from '@/lib/nl-search'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const query = String(body?.query ?? '').trim()
  if (!query) return NextResponse.json({ error: 'Üres kérdés' }, { status: 400 })

  const rows = await db.select({
    id: anime.id, title: anime.titleRomaji, genres: anime.genres, year: anime.year,
    myScore: anime.myScore, status: anime.status, mediaType: anime.mediaType,
    opinion: opinions.rawText,
  }).from(anime).leftJoin(opinions, eq(opinions.animeId, anime.id))
    .where(eq(anime.userId, userId))
  if (!rows.length) return NextResponse.json({ error: 'Üres a listád' }, { status: 400 })

  const items: NlItem[] = rows.map((r) => ({
    ...r,
    opinion: r.opinion ? (r.opinion.length > 100 ? `${r.opinion.slice(0, 100)}…` : r.opinion) : null,
  }))
  try {
    await consumeAiQuota(userId, 'nl-search')
    const raw = await glmChat(buildNlMessages(items, query), { userId, endpoint: 'nl-search' })
    return NextResponse.json(parseNlResult(raw, new Set(items.map((i) => i.id))))
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
