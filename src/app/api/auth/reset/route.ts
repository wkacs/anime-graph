import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { consumeAuthToken, invalidateOtherAuthTokens } from '@/lib/auth-token-store'
import { hashPassword } from '@/lib/password'
import { createSession, SESSION_DAYS } from '@/lib/auth'
import { sessionSecret } from '@/lib/env'
import { clearTokenVersionCache } from '@/lib/token-version'
import { validPasswordLength } from '@/lib/registration'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { eq, sql } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  // A reset-token kriptográfiailag erős, de a végpont eddig korlátlanul
  // hívható volt — a token-tippelés így legalább mérhető költségbe kerül,
  // és a hibás próbálkozás-özön sem terheli az adatbázist.
  if (!(await rateLimit('reset', clientIp(req.headers), 10, 3600))) {
    return apiError('tooManyTriesLater', 429)
  }
  const body = await req.json().catch(() => ({}))
  const raw = String(body.token ?? '')
  const password = String(body.password ?? '')
  if (!validPasswordLength(password)) {
    return apiError('invalidPasswordLength', 400)
  }
  const row = await consumeAuthToken(raw, 'reset')
  if (!row) {
    return apiError('invalidExpiredLink', 400)
  }

  // token_version++ → minden korábbi session érvénytelenné válik
  const [user] = await db.update(users)
    .set({ passwordHash: hashPassword(password), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, row.userId))
    .returning()
  await invalidateOtherAuthTokens(row.userId, 'reset')
  clearTokenVersionCache(user.id)

  const token = await createSession(sessionSecret(), user.id, user.tokenVersion)
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
