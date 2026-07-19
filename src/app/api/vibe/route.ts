import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory, recommendations } from '@/db/schema'
import { buildVibeMessages, parseVibe, type VibeOwnAnime } from '@/lib/vibe'
import { searchAnime } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { glmChat } from '@/lib/glm'

// GLM only names new titles — attach real AniList data so the cards are
// addable with one click. If the best match is already on the list, the pick
// was a known title in disguise → dropped (only genuinely new things survive).
async function enrichNewPicks(
  picks: { title: string; reason: string }[],
  ownedAnilistIds: Set<number>,
) {
  const enriched = await Promise.all(picks.map(async (p) => {
    try {
      const hit = (await searchAnime(p.title))[0]
      if (!hit) return { ...p, anilistId: null, coverUrl: null, year: null, genres: [] }
      if (ownedAnilistIds.has(hit.anilistId)) return null
      return {
        title: hit.titleRomaji,
        reason: p.reason,
        anilistId: hit.anilistId,
        coverUrl: hit.coverUrl,
        year: hit.year,
        genres: hit.genres,
      }
    } catch {
      return { ...p, anilistId: null, coverUrl: null, year: null, genres: [] }
    }
  }))
  return enriched.filter((p): p is NonNullable<typeof p> => p !== null)
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const prompt = String(body?.prompt ?? '').trim()
  const animeIds: number[] = Array.isArray(body?.animeIds) ? body.animeIds.map(Number) : []
  if (!prompt && !animeIds.length) {
    return NextResponse.json({ error: 'Írj be egy kérést vagy válassz animét' }, { status: 400 })
  }

  const rows = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.mediaType, 'ANIME')))
  if (!rows.length) return NextResponse.json({ error: 'Előbb adj hozzá animéket' }, { status: 400 })
  const factRows = await db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId))

  const selectedSet = new Set(animeIds)
  const own: VibeOwnAnime[] = rows.map((r) => ({
    id: r.id,
    title: r.titleRomaji,
    genres: r.genres,
    facts: factRows.filter((f) => f.animeId === r.id).map((f) => `(${f.kind}) ${f.text}`),
    selected: selectedSet.has(r.id),
  }))
  const globalFacts = factRows
    .filter((f) => f.animeId == null || !selectedSet.has(f.animeId))
    .map((f) => `(${f.kind}) ${f.text}`)
    .slice(0, 60)

  try {
    await consumeAiQuota(userId)
    const raw = await glmChat(buildVibeMessages(prompt || 'a kiválasztott animékhez hasonlót keresek', own, globalFacts))
    const parsed = parseVibe(raw)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const ownPicks = parsed.ownPicks
      .filter((p) => byId.has(p.animeId))
      .map((p) => {
        const a = byId.get(p.animeId)!
        return {
          animeId: a.id,
          title: a.titleRomaji,
          coverUrl: a.coverUrl,
          genres: a.genres,
          status: a.status,
          reason: p.reason,
        }
      })
    const owned = new Set(rows.map((r) => r.anilistId))
    // hard guarantee: a "new" pick must not be on the list, even if the GLM slips
    const ownedTitles = new Set(
      rows.flatMap((r) => [r.titleRomaji, r.titleEnglish].filter(Boolean).map((t) => t!.toLowerCase())),
    )
    const freshOnly = parsed.newPicks
      .filter((p) => !ownedTitles.has(p.title.toLowerCase()))
      .slice(0, 6)
    const result = {
      ownPicks: ownPicks.slice(0, 4),
      newPicks: await enrichNewPicks(freshOnly, owned),
    }
    await db.insert(recommendations).values({
      userId,
      kind: 'vibe',
      input: { prompt, animeIds },
      result,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
