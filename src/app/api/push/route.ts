import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { pushSubscriptions } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const endpoint = String(body?.endpoint ?? '')
  const p256dh = String(body?.keys?.p256dh ?? '')
  const auth = String(body?.keys?.auth ?? '')
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'hiányos subscription' }, { status: 400 })
  await db.insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh, auth } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const endpoint = String(body?.endpoint ?? '')
  if (!endpoint) return NextResponse.json({ error: 'endpoint kötelező' }, { status: 400 })
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  return NextResponse.json({ ok: true })
}
