import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createSession, SESSION_DAYS } from '@/lib/auth'
import { sessionSecret } from '@/lib/env'
import { verifyPassword } from '@/lib/password'
import { clientIp, rateLimit, clearRateLimit } from '@/lib/rate-limit'
import { eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/session'
import { apiError } from '@/lib/api-error'

export async function GET() {
  return NextResponse.json({ authenticated: Boolean(await requireUserId()) }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

function sessionResponse(token: string, body: object = { ok: true }) {
  const res = NextResponse.json(body)
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: '/',
  })
  return res
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const username = String(body.username ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!username || !password) {
    return apiError('credentialsRequired', 400)
  }
  // brute-force fék: 10 próbálkozás / 10 perc / IP; sikeres belépés törli a számlálót
  const ip = clientIp(req.headers)
  if (!(await rateLimit('login', ip, 10, 600))) {
    return apiError('tooManyTriesMinutes', 429)
  }
  const [user] = await db.select().from(users).where(eq(users.username, username))
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return apiError('badCredentials', 401)
  }
  await clearRateLimit('login', ip)
  const token = await createSession(sessionSecret(), user.id, user.tokenVersion)
  return sessionResponse(token)
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
