import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { syncAccounts } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select({
    provider: syncAccounts.provider,
    externalUsername: syncAccounts.externalUsername,
    createdAt: syncAccounts.createdAt,
  }).from(syncAccounts).where(eq(syncAccounts.userId, userId))
  const configured = {
    mal: Boolean(process.env.MAL_CLIENT_ID),
    anilist: Boolean(process.env.ANILIST_CLIENT_ID),
  }
  return NextResponse.json({ accounts: rows, configured })
}
