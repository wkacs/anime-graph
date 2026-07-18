import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createSession } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'
import { eq } from 'drizzle-orm'

function sessionResponse(token: string, body: object = { ok: true }) {
  const res = NextResponse.json(body)
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const username = String(body.username ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!username || !password) {
    return NextResponse.json({ error: 'Felhasználónév és jelszó kell' }, { status: 400 })
  }
  const [user] = await db.select().from(users).where(eq(users.username, username))
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Hibás felhasználónév vagy jelszó' }, { status: 401 })
  }
  const token = await createSession(process.env.SESSION_SECRET!, user.id)
  return sessionResponse(token)
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
