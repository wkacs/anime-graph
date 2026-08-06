import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { recommendations } from '@/db/schema'
import { aiCacheKind } from '@/lib/ai-cache-key'
import { loadRecContext, rankCandidates } from '@/lib/rec-context'
import { requireUserId } from '@/lib/session'
import { apiError } from '@/lib/api-error'

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await loadRecContext(userId)
  if (!ctx) return apiError('addAnimeFirst', 400)
  if (!ctx.candidates.length) return apiError('notEnoughCatalog', 502)

  const result = rankCandidates(ctx.candidates, ctx.vector, ctx.locale, 10)
  if (!result.length) return apiError('notEnoughData', 502)

  await db.insert(recommendations).values({
    userId,
    kind: aiCacheKind('recommend', ctx.locale),
    input: { topTitles: ctx.top.map((t) => t.titleRomaji), candidateCount: ctx.candidates.length },
    result,
  })
  return NextResponse.json({ picks: result })
}
