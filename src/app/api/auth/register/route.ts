import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { createSession, SESSION_DAYS } from '@/lib/auth'
import { emailDeliveryConfigured, sessionSecret } from '@/lib/env'
import { hashPassword } from '@/lib/password'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { registrationMode, validateRegistration } from '@/lib/registration'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import {
  discardAuthToken, issueAuthToken,
} from '@/lib/auth-token-store'
import { eq, sql } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'
import { serverT } from '@/lib/server-i18n'

export async function POST(req: NextRequest) {
  const mode = registrationMode()
  if (mode === 'closed') {
    return apiError('registrationClosed', 503)
  }
  // Éles rendszerben nem hozunk létre olyan új fiókot, amelyhez nem tudunk
  // megerősítő- és jelszó-visszaállító e-mailt kézbesíteni. Fejlesztésben a
  // no-op küldő marad, hogy a helyi munka ne igényeljen külső szolgáltatást.
  if (process.env.NODE_ENV === 'production' && !emailDeliveryConfigured()) {
    return apiError('registrationEmailUnset', 503)
  }
  const body = await req.json().catch(() => ({}))
  const invite = String(body.invite ?? '')
  const locale = body.locale === 'hu' ? 'hu' : 'en'

  // brute-force fék: 5 próbálkozás / óra / IP
  const ip = clientIp(req.headers)
  if (!(await rateLimit('register', ip, 5, 3600))) {
    return apiError('tooManyTries', 429)
  }

  if (mode === 'invite') {
    if (!process.env.INVITE_CODE) {
      return apiError('registrationClosedNoInvite', 503)
    }
    if (invite !== process.env.INVITE_CODE) {
      return apiError('invalidInvite', 403)
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
    return apiError('tooManyTries', 429)
  }

  const [byName] = await db.select({ id: users.id }).from(users)
    .where(eq(users.username, valid.username))
  if (byName) {
    const t = await serverT('apiErrors')
    return NextResponse.json({ error: t('usernameTaken'), field: 'username' }, { status: 409 })
  }
  const [byEmail] = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${valid.email}`)
  if (byEmail) {
    const t = await serverT('apiErrors')
    return NextResponse.json({ error: t('emailTaken'), field: 'email' }, { status: 409 })
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
  const issued = await issueAuthToken(user.id, 'verify')
  const mail = verifyEmailTemplate(issued.raw, locale)
  const delivery = await sendEmail(valid.email, mail.subject, mail.html, {
    text: mail.text,
    idempotencyKey: `verify-${user.id}-${issued.tokenHash.slice(0, 24)}`,
    tag: 'email-verification',
  })
  if (!delivery.sent && (process.env.NODE_ENV === 'production' || emailDeliveryConfigured())) {
    // Sikertelen kézbesítés után ne maradjon beléphető, de megerősíthetetlen fiók.
    await db.delete(users).where(eq(users.id, user.id))
    return apiError('verifyEmailUnavailable', 503)
  }
  if (!delivery.sent) {
    // Helyi fejlesztés külső levélküldő nélkül is használható; productionben ez az ág tiltott.
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id))
    await discardAuthToken(issued.id)
  }

  // a fiók azonnal használható, a megerősítés párhuzamosan fut
  const token = await createSession(sessionSecret(), user.id, user.tokenVersion)
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
