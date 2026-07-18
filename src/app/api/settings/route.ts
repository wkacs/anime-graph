import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { settings, tasteMemory } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function upsert(key: string, value: unknown) {
  await db.insert(settings)
    .values({ key, value: value as object })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as object } })
}

export async function GET() {
  const rows = await db.select().from(settings)
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json({
    tasteLikes: map.tasteLikes ?? '',
    tasteDislikes: map.tasteDislikes ?? '',
    hierarchyDefault: map.hierarchyDefault ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })

  if (body.hierarchyDefault !== undefined) {
    await upsert('hierarchyDefault', body.hierarchyDefault)
  }

  if (body.tasteLikes !== undefined || body.tasteDislikes !== undefined) {
    const likes = String(body.tasteLikes ?? '')
    const dislikes = String(body.tasteDislikes ?? '')
    await upsert('tasteLikes', likes)
    await upsert('tasteDislikes', dislikes)

    // global taste lists live in taste_memory (animeId null, source=settings)
    await db.delete(tasteMemory).where(
      and(isNull(tasteMemory.animeId), eq(tasteMemory.source, 'settings')),
    )
    const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2)
    const rows = [
      ...toLines(likes).map((text) => ({ kind: 'like', text, source: 'settings' })),
      ...toLines(dislikes).map((text) => ({ kind: 'dislike', text, source: 'settings' })),
    ]
    if (rows.length) await db.insert(tasteMemory).values(rows)
  }

  return NextResponse.json({ ok: true })
}
