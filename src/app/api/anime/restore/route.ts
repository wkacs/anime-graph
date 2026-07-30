import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { ensureTitleByFields, addUserTitle } from '@/lib/anime-write'
import type { TitleMetadata } from '@/lib/catalog'
import { titleSlug } from '@/lib/catalog'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const b = body?.bundle
  if (!b?.anime?.anilistId) {
    return apiError('missingResetData', 400)
  }
  const a = b.anime

  const existing = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.anilistId, a.anilistId)))
  if (existing.length) return NextResponse.json({ anime: existing[0] })

  const meta: TitleMetadata = {
    anilistId: a.anilistId, mediaType: a.mediaType ?? 'ANIME',
    slug: titleSlug(a.titleRomaji, a.anilistId),
    titleRomaji: a.titleRomaji, titleEnglish: a.titleEnglish ?? null,
    titleNative: a.titleNative ?? null, coverUrl: a.coverUrl ?? null,
    bannerUrl: a.bannerUrl ?? null, genres: a.genres ?? [], tags: a.tags ?? [],
    studio: a.studio ?? null, season: a.season ?? null, year: a.year ?? null,
    episodes: a.episodes ?? null, durationMin: a.durationMin ?? null,
    format: a.format ?? null, chapters: a.chapters ?? null, volumes: a.volumes ?? null,
    description: a.description ?? null, relations: a.relations ?? [],
    trailerSite: a.trailerSite ?? null, trailerId: a.trailerId ?? null,
    // Legacy export bundles do not carry this field. Those titles are still
    // reclassified by the authoritative catalog sync after restoration.
    isAdult: a.isAdult ? 1 : 0,
    avgScore: a.avgScore ?? null,
  }
  const titleId = await ensureTitleByFields(meta)
  const row = await addUserTitle(userId, titleId, {
    status: a.status ?? 'planned',
    watchedAt: a.watchedAt ? new Date(a.watchedAt) : null,
  })
  // carry the user's score/progress/rewatch back onto the restored row
  const { updateUserTitle } = await import('@/lib/anime-write')
  const restored = await updateUserTitle(userId, row.id, {
    myScore: a.myScore ?? null, progress: a.progress ?? 0,
    rewatchCount: a.rewatchCount ?? 0,
  })

  if (b.opinion?.rawText) {
    await db.insert(opinions).values({
      animeId: row.id, rawText: b.opinion.rawText,
      extractStatus: b.opinion.extractStatus ?? 'done', updatedAt: new Date(),
    })
  }
  if (Array.isArray(b.facts) && b.facts.length) {
    await db.insert(tasteMemory).values(
      b.facts.map((f: { kind: string; text: string; source: string; weight?: number }) => ({
        userId, animeId: row.id, kind: f.kind, text: f.text,
        source: f.source ?? 'opinion', weight: f.weight ?? 1,
      })),
    )
  }
  return NextResponse.json({ anime: restored ?? row }, { status: 201 })
}
