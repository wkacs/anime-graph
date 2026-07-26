import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { createSession, SESSION_DAYS } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { registrationMode, validateRegistration } from '@/lib/registration'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import { eq, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const mode = registrationMode()
  if (mode === 'closed') {
    return NextResponse.json({ error: 'A regisztráció jelenleg zárva' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({}))
  const invite = String(body.invite ?? '')
  const locale = body.locale === 'hu' ? 'hu' : 'en'

  // brute-force fék: 5 próbálkozás / óra / IP
  const ip = clientIp(req.headers)
  if (!(await rateLimit('register', ip, 5, 3600))) {
    return NextResponse.json({ error: 'Túl sok próbálkozás — próbáld később' }, { status: 429 })
  }

  if (mode === 'invite') {
    if (!process.env.INVITE_CODE) {
      return NextResponse.json(
        { error: 'A regisztráció zárva (nincs meghívó-kód beállítva)' }, { status: 503 },
      )
    }
    if (invite !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: 'Érvénytelen meghívó-kód' }, { status: 403 })
    }
  }

  const valid = validateRegistration({
    email: String(body.email ?? ''),
    username: String(body.username ?? ''),
    password: String(body.password ?? ''),
  })
  if (!valid.ok) {
    const msg = {
      email: 'Érvénytelen e-mail-cím',
      username: 'Felhasználónév: 3-24 karakter, kisbetű/szám/kötőjel',
      password: 'A jelszó legalább 8 karakter legyen',
    }[valid.field]
    return NextResponse.json({ error: msg, field: valid.field }, { status: 400 })
  }

  // címenkénti fiókgyártás fékje
  if (!(await rateLimit('register-email', valid.email, 3, 3600))) {
    return NextResponse.json({ error: 'Túl sok próbálkozás — próbáld később' }, { status: 429 })
  }

  const [byName] = await db.select({ id: users.id }).from(users)
    .where(eq(users.username, valid.username))
  if (byName) {
    return NextResponse.json({ error: 'Ez a felhasználónév foglalt', field: 'username' }, { status: 409 })
  }
  const [byEmail] = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${valid.email}`)
  if (byEmail) {
    return NextResponse.json({ error: 'Ezzel az e-maillel már van fiók', field: 'email' }, { status: 409 })
  }

  const [user] = await db.insert(users)
    .values({
      username: valid.username,
      email: valid.email,
      passwordHash: hashPassword(String(body.password)),
      locale,
    })
    .returning()

  // megerősítő token: nyersen csak a linkbe kerül, adatbázisba a hash megy
  const raw = newToken()
  await db.insert(authTokens).values({
    userId: user.id,
    kind: 'verify',
    tokenHash: hashToken(raw),
    expiresAt: tokenExpiry('verify'),
  })
  const mail = verifyEmailTemplate(raw, locale)
  await sendEmail(valid.email, mail.subject, mail.html)

  // a fiók azonnal használható, a megerősítés párhuzamosan fut
  const token = await createSession(process.env.SESSION_SECRET!, user.id, user.tokenVersion)
  const res = NextResponse.json({ ok: true, username: user.username })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: '/',
  })
  return res
}
