import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory, recommendations, tasteSignal, title } from '@/db/schema'
import { buildVibeMessages, parseVibe, type VibeOwnAnime } from '@/lib/vibe'
import { chipFeatureKeys } from '@/lib/vibe-presets'
import { buildTasteVector, computeFit } from '@/lib/fit-score'
import { fitReason } from '@/lib/fit-reason'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { userLocale } from '@/lib/user-locale'
import { searchAnime } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { requireUserId } from '@/lib/session'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { glmChat } from '@/lib/glm'
import { aiUserErrorMessage } from '@/lib/ai-error'
import { INPUT_LIMITS, exceedsTextLimit, isBoundedStringList } from '@/lib/input-limits'
import { apiError } from '@/lib/api-error'

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
      if (!hit) return { ...p, anilistId: null, coverUrl: null, year: null, genres: [], description: null }
      if (ownedAnilistIds.has(hit.anilistId)) return null
      return {
        title: hit.titleRomaji,
        reason: p.reason,
        anilistId: hit.anilistId,
        coverUrl: hit.coverUrl,
        year: hit.year,
        genres: hit.genres,
        description: hit.description,
      }
    } catch {
      return { ...p, anilistId: null, coverUrl: null, year: null, genres: [], description: null }
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
  const custom = String(body?.custom ?? '').trim()
  const chipIds: string[] = Array.isArray(body?.chipIds) ? body.chipIds : []
  if (exceedsTextLimit(prompt, INPUT_LIMITS.vibePrompt) || exceedsTextLimit(custom, INPUT_LIMITS.vibePrompt)) {
    return apiError('vibePromptMax', 413, { max: INPUT_LIMITS.vibePrompt })
  }
  if (animeIds.length > INPUT_LIMITS.maxVibeAnimeIds
    || !isBoundedStringList(chipIds, INPUT_LIMITS.maxVibeChipIds, 80)) {
    return apiError('badFilters', 400)
  }
  if (!prompt && !animeIds.length) {
    return apiError('vibeInputRequired', 400)
  }

  const locale = await userLocale(userId)
  const rows = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.mediaType, 'ANIME')))
  if (!rows.length) return apiError('addAnimeFirst', 400)
  const factRows = await db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId))

  // Chip-only ut: ha nincs szabad szoveg es nincs kivalasztott anime, ES minden
  // chip lekepezheto katalogus-feature-re, akkor nem kell modell.
  const { keys, unmapped } = chipFeatureKeys(chipIds)
  if (!custom && !animeIds.length && keys.length > 0 && unmapped.length === 0) {
    const [signals, catalog] = await Promise.all([
      db.select({
        feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
      }).from(tasteSignal).where(eq(tasteSignal.userId, userId)),
      db.select({
        anilistId: title.anilistId, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
        genres: title.genres, tags: title.tags, year: title.year, description: title.description,
      }).from(title)
        .where(and(eq(title.mediaType, 'ANIME'), eq(title.isAdult, 0), isNotNull(title.coverUrl)))
        .orderBy(desc(title.popularity)).limit(500),
    ])
    const vector = buildTasteVector(rows, signals)
    const ownedAnilist = new Set(rows.map((r) => r.anilistId))
    const newPicks = catalog
      .filter((c) => !ownedAnilist.has(c.anilistId))
      .map((c) => {
        const fit = computeFit(vector, { genres: c.genres, tags: c.tags, extraKeys: keys })
        return fit ? {
          score: fit.score,
          pick: {
            title: c.titleRomaji, reason: fitReason(fit, locale), anilistId: c.anilistId,
            coverUrl: c.coverUrl, year: c.year, genres: c.genres, description: c.description,
          },
        } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.pick)
    // a valasz-alak megegyezik az AI-agaeval, kulonben a /vibe oldal nem tudja megjeleniteni
    return NextResponse.json({ ownPicks: [], newPicks })
  }

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
    await consumeAiQuota(userId, 'vibe')
    const raw = await glmChat(
      buildVibeMessages(
        prompt || 'a kiválasztott animékhez hasonlót keresek',
        own, globalFacts, locale,
      ),
      { userId, endpoint: 'vibe' },
    )
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
      kind: aiCacheKind('vibe', locale),
      input: { prompt, animeIds },
      result,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('vibe failed:', e)
    return NextResponse.json({ error: aiUserErrorMessage(e) }, { status: 502 })
  }
}
