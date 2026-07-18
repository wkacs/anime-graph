import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { settings, tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq, isNull } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function upsert(userId: number, key: string, value: unknown) {
  await db.insert(settings)
    .values({ userId, key, value: value as object })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: value as object },
    })
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(settings).where(eq(settings.userId, userId))
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return NextResponse.json({
    tasteLikes: map.tasteLikes ?? '',
    tasteDislikes: map.tasteDislikes ?? '',
    hierarchyDefault: map.hierarchyDefault ?? null,
    publicToken: map.publicToken ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })

  if (body.hierarchyDefault !== undefined) {
    await upsert(userId, 'hierarchyDefault', body.hierarchyDefault)
  }

  // publikus link: true = új token generálása, null = visszavonás
  if (body.publicToken !== undefined) {
    if (body.publicToken === null) {
      await upsert(userId, 'publicToken', null)
    } else {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => b.toString(16).padStart(2, '0')).join('')
      await upsert(userId, 'publicToken', token)
      return NextResponse.json({ ok: true, publicToken: token })
    }
  }

  if (body.tasteLikes !== undefined || body.tasteDislikes !== undefined) {
    const likes = String(body.tasteLikes ?? '')
    const dislikes = String(body.tasteDislikes ?? '')
    await upsert(userId, 'tasteLikes', likes)
    await upsert(userId, 'tasteDislikes', dislikes)

    // global taste lists live in taste_memory (animeId null, source=settings)
    await db.delete(tasteMemory).where(
      and(
        eq(tasteMemory.userId, userId),
        isNull(tasteMemory.animeId),
        eq(tasteMemory.source, 'settings'),
      ),
    )
    const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2)
    const rows = [
      ...toLines(likes).map((text) => ({ userId, kind: 'like', text, source: 'settings' })),
      ...toLines(dislikes).map((text) => ({ userId, kind: 'dislike', text, source: 'settings' })),
    ]
    if (rows.length) await db.insert(tasteMemory).values(rows)
  }

  return NextResponse.json({ ok: true })
}
