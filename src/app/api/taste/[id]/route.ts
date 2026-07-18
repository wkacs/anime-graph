import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { tasteMemory } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.delete(tasteMemory).where(eq(tasteMemory.id, Number(id)))
  return NextResponse.json({ ok: true })
}
