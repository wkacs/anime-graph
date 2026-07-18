import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  await db.delete(tasteMemory).where(
    and(eq(tasteMemory.id, Number(id)), eq(tasteMemory.userId, userId)),
  )
  return NextResponse.json({ ok: true })
}
