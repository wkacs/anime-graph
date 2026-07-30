import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { userLocale } from '@/lib/user-locale'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildRecommendMessages, parsePicks } from '@/lib/recommend'
import { glmChat } from '@/lib/glm'
import { aiUserErrorMessage } from '@/lib/ai-error'
import { eq } from 'drizzle-orm'
import { INPUT_LIMITS, exceedsTextLimit } from '@/lib/input-limits'
import { apiError } from '@/lib/api-error'

// Egyetlen AI-hívás IGÉNYRE: a MÁR lokálisan kiválasztott ajánlásokhoz ír prózát.
// A rangsort NEM változtatja meg — az a fit-vektor dolga. Hiba esetén a hívó
// megtartja a lokális indoklást, a lista sosem tűnik el.
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const picks = Array.isArray(body?.picks) ? body.picks : []
  if (!picks.length) return apiError('picksRequired', 400)
  const serializedPicks = JSON.stringify(picks)
  if (picks.length > INPUT_LIMITS.maxRecommendPicks
    || exceedsTextLimit(serializedPicks, INPUT_LIMITS.recommendExplainPayload)) {
    return apiError('recommendTooLong', 413)
  }

  try {
    await consumeAiQuota(userId, 'recommend')
    const factRows = await db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId))
    const facts = factRows.map((f) => ({ kind: f.kind, text: f.text, title: null }))
    const raw = await glmChat(
      buildRecommendMessages(picks, facts, [], await userLocale(userId)),
      { userId, endpoint: 'recommend-explain' },
    )
    return NextResponse.json({ picks: parsePicks(raw) })
  } catch (e) {
    console.error('recommend-explain failed:', e)
    return NextResponse.json({ error: aiUserErrorMessage(e) }, { status: 502 })
  }
}
