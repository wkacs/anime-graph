import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import { eq } from 'drizzle-orm'

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await rateLimit('verify-resend', String(userId), 3, 3600))) {
    return NextResponse.json({ error: 'Túl sok próbálkozás — próbáld később' }, { status: 429 })
  }
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user?.email) {
    return NextResponse.json({ error: 'Nincs e-mail a fiókon' }, { status: 400 })
  }
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, already: true })

  const raw = newToken()
  await db.insert(authTokens).values({
    userId, kind: 'verify', tokenHash: hashToken(raw), expiresAt: tokenExpiry('verify'),
  })
  const mail = verifyEmailTemplate(raw, user.locale)
  await sendEmail(user.email, mail.subject, mail.html)
  return NextResponse.json({ ok: true })
}
