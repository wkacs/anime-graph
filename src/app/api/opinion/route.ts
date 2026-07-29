import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, recommendations, tasteMemory, tasteSignal, title } from '@/db/schema'
import { extractAll, filterSignals } from '@/lib/extract'
import { titleFeatureKeys } from '@/lib/taste-features'
import { userLocale } from '@/lib/user-locale'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { INPUT_LIMITS, exceedsTextLimit } from '@/lib/input-limits'
import { and, eq, like, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const animeId = Number(req.nextUrl.searchParams.get('animeId'))
  if (!animeId) return NextResponse.json({ opinion: null })
  const [animeRow] = await db.select().from(anime)
    .where(and(eq(anime.id, animeId), eq(anime.userId, userId)))
  if (!animeRow) return NextResponse.json({ opinion: null })
  const [row] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
  return NextResponse.json({ opinion: row ?? null })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const animeId = Number(body?.animeId)
  if (!animeId) return NextResponse.json({ error: 'animeId kötelező' }, { status: 400 })

  const [animeRow] = await db.select().from(anime)
    .where(and(eq(anime.id, animeId), eq(anime.userId, userId)))
  if (!animeRow) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })

  let rawText: string
  if (body.retry === true) {
    const [existing] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
    if (!existing) return NextResponse.json({ error: 'Nincs mentett vélemény' }, { status: 404 })
    rawText = existing.rawText
  } else {
    rawText = String(body.rawText ?? '').trim()
    if (!rawText) return NextResponse.json({ error: 'Üres vélemény' }, { status: 400 })
    if (exceedsTextLimit(rawText, INPUT_LIMITS.opinion)) {
      return NextResponse.json({ error: `A vélemény legfeljebb ${INPUT_LIMITS.opinion} karakter lehet` }, { status: 413 })
    }
    await db.insert(opinions)
      .values({ animeId, rawText, extractStatus: 'pending', updatedAt: new Date() })
      .onConflictDoUpdate({
        target: opinions.animeId,
        set: { rawText, extractStatus: 'pending', updatedAt: new Date() },
      })
  }

  if (exceedsTextLimit(rawText, INPUT_LIMITS.opinion)) {
    return NextResponse.json({ error: 'A mentett vélemény túl hosszú az AI-feldolgozáshoz' }, { status: 422 })
  }

  try {
    await consumeAiQuota(userId, 'opinion')
    const locale = await userLocale(userId)
    // a jelölt feature-ök a VÉLEMÉNY TÁRGYÁNAK saját készlete
    const [titleRow] = await db.select({
      id: title.id, genres: title.genres, tags: title.tags, format: title.format,
      episodes: title.episodes, chapters: title.chapters, year: title.year,
      studio: title.studio, mediaType: title.mediaType, relations: title.relations,
    }).from(title).where(eq(title.id, animeRow.titleId))
    const allowed = titleRow ? titleFeatureKeys(titleRow) : []

    const { facts, signals } = await extractAll(
      animeRow.titleRomaji, rawText, locale, allowed, { userId, endpoint: 'opinion' },
    )
    await db.delete(tasteMemory).where(
      and(eq(tasteMemory.animeId, animeId), eq(tasteMemory.source, 'opinion')),
    )
    // lang: a tény azon a nyelven él, amin kinyertük — a felületen így jelenik meg
    const inserted = await db.insert(tasteMemory).values(
      facts.map((f) => ({ userId, animeId, kind: f.kind, text: f.text, source: 'opinion', lang: locale })),
    ).returning()

    // gépi jelek a rangsoroló vektorhoz — a szókészlet-őrön átszűrve
    const clean = filterSignals(signals, allowed)
    if (titleRow && clean.length) {
      await db.insert(tasteSignal).values(clean.map((s) => ({
        userId, titleId: titleRow.id, feature: s.feature,
        polarity: s.polarity, strength: s.strength, source: 'opinion',
      }))).onConflictDoUpdate({
        target: [tasteSignal.userId, tasteSignal.titleId, tasteSignal.feature],
        set: { polarity: sql`excluded.polarity`, strength: sql`excluded.strength` },
      })
    }
    await db.update(opinions).set({ extractStatus: 'done' }).where(eq(opinions.animeId, animeId))
    // új ízlés-tények → a korszak-cache elavult
    await db.delete(recommendations).where(
      and(eq(recommendations.userId, userId), like(recommendations.kind, 'taste-eras%')),
    )
    return NextResponse.json({ extractStatus: 'done', facts: inserted })
  } catch (e) {
    await db.update(opinions).set({ extractStatus: 'failed' }).where(eq(opinions.animeId, animeId))
    return NextResponse.json({ extractStatus: 'failed', error: String(e), facts: [] })
  }
}
