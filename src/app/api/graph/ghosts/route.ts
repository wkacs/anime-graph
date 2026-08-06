import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { settings } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { loadRecContext, rankCandidates } from '@/lib/rec-context'
import { GHOST_DISMISS_KEY, addDismissed, parseDismissed } from '@/lib/ghost-dismiss'
import { MAX_GHOSTS } from '@/lib/graph-builder'
import { apiError } from '@/lib/api-error'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function dismissedFor(userId: number): Promise<number[]> {
  const [row] = await db.select({ value: settings.value }).from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, GHOST_DISMISS_KEY)))
  return parseDismissed(row?.value)
}

// A grafon lebego ajanlasok. A /api/recommend-del KOZOS keszletbol dolgozik
// (lib/rec-context), csak kevesebbet ker es NEM naploz: a graf minden megnyitasa
// kulonben tele irna a recommendations tablat ajanlas-elozmennyel.
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await loadRecContext(userId)
  // A graf ures listaval is megnyithato — ott egyszeruen nincs mit lebegtetni.
  if (!ctx || !ctx.candidates.length) return NextResponse.json({ picks: [] })

  const exclude = new Set(await dismissedFor(userId))
  const picks = rankCandidates(ctx.candidates, ctx.vector, ctx.locale, MAX_GHOSTS * 3, exclude)
    .map((p) => ({
      anilistId: p.anilistId, title: p.title, coverUrl: p.coverUrl,
      genres: p.genres, score: p.score, reason: p.reason,
    }))
  return NextResponse.json({ picks })
}

// „Nem nekem valo": az adott cim nem jon vissza tobbet a grafra.
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const anilistId = (body as { anilistId?: unknown } | null)?.anilistId
  if (!Number.isInteger(anilistId) || (anilistId as number) <= 0) return apiError('idRequired', 400)

  const [row] = await db.select({ value: settings.value }).from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, GHOST_DISMISS_KEY)))
  const next = addDismissed(row?.value, anilistId as number)
  await db.insert(settings)
    .values({ userId, key: GHOST_DISMISS_KEY, value: next })
    .onConflictDoUpdate({ target: [settings.userId, settings.key], set: { value: next } })
  return NextResponse.json({ ok: true, dismissed: next.length })
}
