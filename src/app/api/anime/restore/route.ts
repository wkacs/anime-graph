import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory, type AnimeInsert } from '@/db/schema'
import { eq } from 'drizzle-orm'

// undo for a deletion: re-insert the bundle returned by DELETE /api/anime/[id]
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const bundle = body?.bundle
  if (!bundle?.anime?.anilistId) {
    return NextResponse.json({ error: 'Hiányzó visszaállítási adat' }, { status: 400 })
  }

  const existing = await db.select().from(anime)
    .where(eq(anime.anilistId, bundle.anime.anilistId))
  if (existing.length) return NextResponse.json({ anime: existing[0] })

  const { id: _oldId, createdAt: _c, watchedAt, ...rest } = bundle.anime
  const insert: AnimeInsert = {
    ...rest,
    watchedAt: watchedAt ? new Date(watchedAt) : null,
  }
  const [row] = await db.insert(anime).values(insert).returning()

  if (bundle.opinion?.rawText) {
    await db.insert(opinions).values({
      animeId: row.id,
      rawText: bundle.opinion.rawText,
      extractStatus: bundle.opinion.extractStatus ?? 'done',
      updatedAt: new Date(),
    })
  }
  if (Array.isArray(bundle.facts) && bundle.facts.length) {
    await db.insert(tasteMemory).values(
      bundle.facts.map((f: { kind: string; text: string; source: string; weight?: number }) => ({
        animeId: row.id,
        kind: f.kind,
        text: f.text,
        source: f.source ?? 'opinion',
        weight: f.weight ?? 1,
      })),
    )
  }
  return NextResponse.json({ anime: row }, { status: 201 })
}
