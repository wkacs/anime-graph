import { db } from '@/db/client'
import { anime, title, titleRecommendations, tasteSignal } from '@/db/schema'
import { buildLocalCandidates } from './local-candidates'
import { buildTasteVector, computeFit, type TasteVector } from './fit-score'
import { fitReason } from './fit-reason'
import { userLocale } from './user-locale'
import type { RecCandidate } from './anilist'
import type { Locale } from './locale'
import { and, eq, inArray } from 'drizzle-orm'

// A lokalis ajanlas ket fogyasztoja (a /api/recommend lista es a graf ghost-node-jai)
// ugyanabbol a keszletbol dolgozik. Korabban ez az osszeallitas ket helyen allt volna;
// egy helyen tartva nem tudnak szetcsuszni — az kulonben ugy jelentkezne, hogy a graf
// mast ajanl, mint az Ajanlj-nekem lista, es a felhasznalo joggal nem hinne egyiknek sem.

export type RecContext = {
  /** a user teljes ANIME-listaja (a fit-vektor forrasa) */
  rows: Awaited<ReturnType<typeof loadRows>>
  /** legjobbra ertekelt 5 cim */
  top: Awaited<ReturnType<typeof loadRows>>
  candidates: RecCandidate[]
  vector: TasteVector
  locale: Locale
  ownedAnilistIds: Set<number>
}

function loadRows(userId: number) {
  return db.select().from(anime).where(and(eq(anime.userId, userId), eq(anime.mediaType, 'ANIME')))
}

/** null = a usernek nincs meg listaja, tehat nincs mibol ajanlani. */
export async function loadRecContext(userId: number): Promise<RecContext | null> {
  const rows = await loadRows(userId)
  if (!rows.length) return null

  const top = [...rows].sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0)).slice(0, 5)
  const favorites = top.map((t) => ({
    anilistId: t.anilistId, genres: t.genres,
    relations: (t.relations ?? []).map((r) => r.anilistId),
  }))
  const catalog = await db.select({
    anilistId: title.anilistId, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
    genres: title.genres, tags: title.tags,
    communityScore: title.communityScore, avgScore: title.avgScore,
    relations: title.relations,
  }).from(title).where(and(eq(title.mediaType, 'ANIME'), eq(title.isAdult, 0)))

  const ownedAnilistIds = new Set(rows.map((r) => r.anilistId))
  // batch-cache-elt AniList-recs (heti sync) a kedvenc cimekre — kollaborativ jel elo hivas nelkul
  const topIds = top.map((t) => t.anilistId)
  const recRows = topIds.length
    ? await db.select({ recAnilistId: titleRecommendations.recAnilistId })
        .from(titleRecommendations).where(inArray(titleRecommendations.anilistId, topIds))
    : []
  const candidates = buildLocalCandidates(
    favorites, catalog, ownedAnilistIds, 200, new Set(recRows.map((r) => r.recAnilistId)),
  )

  const signals = await db.select({
    feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
  }).from(tasteSignal).where(eq(tasteSignal.userId, userId))

  return {
    rows, top, candidates,
    vector: buildTasteVector(rows, signals),
    locale: await userLocale(userId),
    ownedAnilistIds,
  }
}

export type RankedPick = RecCandidate & { score: number; reason: string }

/**
 * Lokalis rangsor: nulla modellhivas. A „miert" a vektorbol jon (fit-reason),
 * AI-proza csak kulon vegponton, gombnyomasra.
 */
export function rankCandidates(
  candidates: RecCandidate[],
  vector: TasteVector,
  locale: Locale,
  limit: number,
  exclude: Set<number> = new Set(),
): RankedPick[] {
  return candidates
    .filter((c) => !exclude.has(c.anilistId))
    .map((c) => {
      const fit = computeFit(vector, { genres: c.genres, tags: c.tags ?? [] })
      return fit ? { ...c, score: fit.score, reason: fitReason(fit, locale) } : null
    })
    .filter((x): x is RankedPick => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
