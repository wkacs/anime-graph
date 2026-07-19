import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { animeStaff } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const staff = await db.select({
    staffId: animeStaff.staffId, name: animeStaff.name,
    image: animeStaff.image, animeId: animeStaff.animeId,
  }).from(animeStaff).where(eq(animeStaff.userId, userId))
  return NextResponse.json({ staff })
}
