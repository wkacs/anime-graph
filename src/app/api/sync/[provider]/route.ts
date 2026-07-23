import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { syncAccounts } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { isProvider } from '@/lib/sync-oauth'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { provider } = await ctx.params
  if (!isProvider(provider)) return NextResponse.json({ error: 'ismeretlen provider' }, { status: 400 })
  await db.delete(syncAccounts)
    .where(and(eq(syncAccounts.userId, userId), eq(syncAccounts.provider, provider)))
  return NextResponse.json({ ok: true })
}
