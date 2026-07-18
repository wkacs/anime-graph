import { NextRequest, NextResponse } from 'next/server'
import { sessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Hibás jelszó' }, { status: 401 })
  }
  const token = await sessionToken(process.env.SESSION_SECRET!)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
