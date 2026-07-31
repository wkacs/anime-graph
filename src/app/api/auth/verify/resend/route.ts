import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import {
  discardAuthToken, invalidateOtherAuthTokens, issueAuthToken,
} from '@/lib/auth-token-store'
import { eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await rateLimit('verify-resend', String(userId), 3, 3600))) {
    return apiError('tooManyTries', 429)
  }
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user?.email) {
    return apiError('noEmailOnAccount', 400)
  }
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, already: true })

  const issued = await issueAuthToken(userId, 'verify')
  const mail = verifyEmailTemplate(issued.raw, user.locale)
  const delivery = await sendEmail(user.email, mail.subject, mail.html, {
    text: mail.text,
    idempotencyKey: `verify-${userId}-${issued.tokenHash.slice(0, 24)}`,
    tag: 'email-verification',
  })
  if (!delivery.sent) {
    await discardAuthToken(issued.id)
    return apiError('verifyEmailUnavailable', 503)
  }
  await invalidateOtherAuthTokens(userId, 'verify', issued.id)
  return NextResponse.json({ ok: true })
}
