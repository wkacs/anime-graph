import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { hashToken, isTokenUsable } from '@/lib/auth-token'
import { hashPassword } from '@/lib/password'
import { createSession, SESSION_DAYS } from '@/lib/auth'
import { clearTokenVersionCache } from '@/lib/token-version'
import { MIN_PASSWORD_LENGTH } from '@/lib/registration'
import { and, eq, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const raw = String(body.token ?? '')
  const password = String(body.password ?? '')
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'A jelszó legalább 8 karakter legyen' }, { status: 400 })
  }
  const [row] = await db.select().from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(raw)), eq(authTokens.kind, 'reset')))
  if (!row || !isTokenUsable(row)) {
    return NextResponse.json({ error: 'Érvénytelen vagy lejárt link' }, { status: 400 })
  }

  // token_version++ → minden korábbi session érvénytelenné válik
  const [user] = await db.update(users)
    .set({ passwordHash: hashPassword(password), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, row.userId))
    .returning()
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id))
  clearTokenVersionCache(user.id)

  const token = await createSession(process.env.SESSION_SECRET!, user.id, user.tokenVersion)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: '/',
  })
  return res
}
