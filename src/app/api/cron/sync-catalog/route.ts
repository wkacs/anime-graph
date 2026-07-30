import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { anilistFetch, MEDIA_FIELDS, type AnilistMedia } from '@/lib/anilist'
import { mapTitle } from '@/lib/catalog'
import { sliceNewMedia, defaultWatermark, nextWatermark } from '@/lib/catalog-sync'
import { getCached, setCached } from '@/lib/api-cache'
import { authorizeCron } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Napi inkrementális katalógus-sync (Vercel-cron): az AniList-en a legutóbbi
// futás óta MÓDOSULT címek frissítése UPDATED_AT_DESC lapozással. A teljes
// sync (scripts/sync-catalog.mjs) órákig tart — az kézi/egyszeri eszköz marad,
// ez a napi karbantartó.
const PAGE_CAP = 15 // 15 lap × 50 cím típusonként — egy átlagos nap bőven belefér
const TIME_BUDGET_MS = 40_000 // a maxDuration alatt maradunk, a maradék holnap jön
const WATERMARK_TTL_SEC = 365 * 86_400 // a vízjel nem járhat le futások között

type SyncMedia = AnilistMedia & { updatedAt: number }
type SyncPage = { Page: { pageInfo: { hasNextPage: boolean }; media: SyncMedia[] } }

const SYNC_QUERY = `
query ($page: Int!, $type: MediaType!) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: $type, sort: UPDATED_AT_DESC) {
      updatedAt${MEDIA_FIELDS}
    }
  }
}`

async function upsertTitle(m: SyncMedia): Promise<void> {
  const meta = mapTitle(m)
  // slug/címmezők SZÁNDÉKOSAN nem frissülnek konfliktusnál: a slug URL-azonosító,
  // átírása eltörné a kanonikus címoldalakat és a sitemap-et.
  await db.insert(title).values(meta).onConflictDoUpdate({
    target: [title.anilistId, title.mediaType],
    set: {
      coverUrl: meta.coverUrl, bannerUrl: meta.bannerUrl, genres: meta.genres,
      tags: meta.tags, studio: meta.studio, season: meta.season, year: meta.year,
      episodes: meta.episodes, durationMin: meta.durationMin, format: meta.format,
      chapters: meta.chapters, volumes: meta.volumes, description: meta.description,
      relations: meta.relations, trailerSite: meta.trailerSite, trailerId: meta.trailerId,
      isAdult: meta.isAdult, avgScore: meta.avgScore, syncedAt: sql`now()`,
    },
  })
}

export async function GET(req: NextRequest) {
  const auth = authorizeCron(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (auth === 'misconfigured') return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  if (auth === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const start = Date.now()
  const nowSec = Math.floor(start / 1000)
  const result: Record<string, { synced: number; pages: number; capped: boolean }> = {}

  for (const type of ['ANIME', 'MANGA'] as const) {
    const cacheKey = `catalog-sync:${type}`
    const stored = await getCached<{ watermark: number }>(cacheKey)
    const watermark = stored?.watermark ?? defaultWatermark(nowSec)
    let wm = watermark
    let synced = 0
    let pages = 0
    let capped = false

    for (let page = 1; page <= PAGE_CAP; page++) {
      if (Date.now() - start > TIME_BUDGET_MS) { capped = true; break }
      const data = await anilistFetch<SyncPage>(SYNC_QUERY, { page, type })
      const media = data.Page.media
      pages++
      const { fresh, morePages } = sliceNewMedia(media, watermark)
      // laponként párhuzamos upsert: 50 soros HTTP-kör helyett egy hullám
      await Promise.all(fresh.map(upsertTitle))
      synced += fresh.length
      wm = nextWatermark(wm, media)
      if (!morePages || !data.Page.pageInfo.hasNextPage) break
      if (page === PAGE_CAP) capped = true
    }

    // capped futásnál a vízjel NEM léphet előre a feldolgozatlan sáv fölé —
    // maradunk a réginél, a következő futás onnan folytatja. Kivétel az első
    // futás (nincs tárolt vízjel): ott előre KELL lépni, különben nagy
    // hátraléknál örökre ugyanazt a sávot kérnénk — a kimaradó régebbi tételeket
    // a kézi scripts/sync-catalog.mjs fedi le.
    if (!capped || !stored) await setCached(cacheKey, { watermark: wm }, WATERMARK_TTL_SEC)
    result[type] = { synced, pages, capped }
  }

  return NextResponse.json(result)
}
