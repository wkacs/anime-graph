import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { favoriteCharacters } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const favorites = await db.select().from(favoriteCharacters)
    .where(eq(favoriteCharacters.userId, userId))
  return NextResponse.json({ favorites })
}
