import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { sendEmail, resetEmailTemplate } from '@/lib/email'
import {
  discardAuthToken, invalidateOtherAuthTokens, issueAuthToken,
} from '@/lib/auth-token-store'
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
      try {
        const issued = await issueAuthToken(user.id, 'reset')
        const mail = resetEmailTemplate(issued.raw, user.locale)
        const delivery = await sendEmail(email, mail.subject, mail.html, {
          text: mail.text,
          idempotencyKey: `reset-${user.id}-${issued.tokenHash.slice(0, 24)}`,
          tag: 'password-reset',
        })
        if (delivery.sent) {
          await invalidateOtherAuthTokens(user.id, 'reset', issued.id)
        } else {
          await discardAuthToken(issued.id)
          console.error('Jelszó-visszaállító levél kézbesítése sikertelen')
        }
      } catch {
        // A külső válasz mindig azonos marad, így üzemzavarban sem lesz user-enumeration.
        console.error('Jelszó-visszaállítás belső feldolgozása sikertelen')
      }
    }
  }
  return NextResponse.json({ ok: true })
}
