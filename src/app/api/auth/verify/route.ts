import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { consumeAuthToken, invalidateOtherAuthTokens } from '@/lib/auth-token-store'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// A linkből érkező nyers tokent hash-eljük és úgy keressük — nyers token
// sosem volt adatbázisban.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('token') ?? ''
  const row = await consumeAuthToken(raw, 'verify')
  if (!row) {
    return NextResponse.redirect(new URL('/beallitasok?verify=invalid', req.url))
  }
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId))
  await invalidateOtherAuthTokens(row.userId, 'verify')
  return NextResponse.redirect(new URL('/?verify=ok', req.url))
}
