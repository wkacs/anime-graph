import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, resetEmailTemplate } from '@/lib/email'
import { sql } from 'drizzle-orm'

// MINDIG 200-at ad, létező és nem létező címre egyaránt: különben a végpont
// elárulná, ki regisztrált nálunk (user-enumeration).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()

  const ipAllowed = await rateLimit('forgot-ip', clientIp(req.headers), 10, 3600)
  const allowed = await rateLimit('forgot-email', email, 3, 3600)

  if (ipAllowed && allowed && email) {
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`)
    if (user) {
      const raw = newToken()
      await db.insert(authTokens).values({
        userId: user.id, kind: 'reset', tokenHash: hashToken(raw), expiresAt: tokenExpiry('reset'),
      })
      const mail = resetEmailTemplate(raw, user.locale)
      await sendEmail(email, mail.subject, mail.html)
    }
  }
  return NextResponse.json({ ok: true })
}
