import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { hashToken, isTokenUsable } from '@/lib/auth-token'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// A linkből érkező nyers tokent hash-eljük és úgy keressük — nyers token
// sosem volt adatbázisban.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('token') ?? ''
  const [row] = await db.select().from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(raw)), eq(authTokens.kind, 'verify')))
  if (!row || !isTokenUsable(row)) {
    return NextResponse.redirect(new URL('/beallitasok?verify=invalid', req.url))
  }
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId))
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id))
  return NextResponse.redirect(new URL('/?verify=ok', req.url))
}
