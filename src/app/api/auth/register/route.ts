import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createSession } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  if (!process.env.INVITE_CODE) {
    return NextResponse.json({ error: 'A regisztráció zárva (nincs meghívó-kód beállítva)' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({}))
  const username = String(body.username ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const invite = String(body.invite ?? '')

  // meghívó-kód brute-force fék: 5 próbálkozás / óra / IP
  if (!(await rateLimit('register', clientIp(req.headers), 5, 3600))) {
    return NextResponse.json({ error: 'Túl sok próbálkozás — próbáld később' }, { status: 429 })
  }
  if (invite !== process.env.INVITE_CODE) {
    return NextResponse.json({ error: 'Érvénytelen meghívó-kód' }, { status: 403 })
  }
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
    return NextResponse.json({ error: 'Felhasználónév: 3-24 karakter, kisbetű/szám/kötőjel' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A jelszó legalább 6 karakter legyen' }, { status: 400 })
  }

  const existing = await db.select().from(users).where(eq(users.username, username))
  if (existing.length) {
    return NextResponse.json({ error: 'Ez a felhasználónév foglalt' }, { status: 409 })
  }

  const [user] = await db.insert(users)
    .values({ username, passwordHash: hashPassword(password) })
    .returning()

  const token = await createSession(process.env.SESSION_SECRET!, user.id)
  const res = NextResponse.json({ ok: true, username: user.username })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}
