import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { settings, tasteMemory, users, authTokens } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { validateRegistration } from '@/lib/registration'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import { and, eq, isNull, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function upsert(userId: number, key: string, value: unknown) {
  await db.insert(settings)
    .values({ userId, key, value: value as object })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: value as object },
    })
}

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(settings).where(eq(settings.userId, userId))
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  return NextResponse.json({
    tasteLikes: map.tasteLikes ?? '',
    tasteDislikes: map.tasteDislikes ?? '',
    hierarchyDefault: map.hierarchyDefault ?? null,
    publicToken: map.publicToken ?? null,
    onboarding: map.onboarding ?? null,
    email: user?.email ?? null,
    emailVerified: user?.emailVerifiedAt != null,
    locale: user?.locale ?? 'en',
    username: user?.username ?? null,
    bio: user?.bio ?? '',
    profileVisibility: map.profileVisibility ?? 'public',
  })
}

export async function PUT(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })

  if (body.hierarchyDefault !== undefined) {
    await upsert(userId, 'hierarchyDefault', body.hierarchyDefault)
  }

  // nyelv: a cookie a kliensen áll be, ez a sor teszi eszközök között követhetővé
  if (body.locale === 'en' || body.locale === 'hu') {
    await db.update(users).set({ locale: body.locale }).where(eq(users.id, userId))
  }

  if (typeof body.bio === 'string') {
    await db.update(users).set({ bio: body.bio.slice(0, 500) }).where(eq(users.id, userId))
  }

  if (body.profileVisibility === 'public' || body.profileVisibility === 'private') {
    await upsert(userId, 'profileVisibility', body.profileVisibility)
  }

  // e-mail-cím pótlása a nyílt regisztráció előtti fiókoknak (id=1):
  // enélkül nincs jelszó-visszaállításuk. Megerősítés újraindul.
  if (typeof body.email === 'string') {
    const valid = validateRegistration({
      email: body.email, username: 'placeholder', password: '12345678',
    })
    if (!valid.ok) {
      return NextResponse.json({ error: 'Érvénytelen e-mail-cím' }, { status: 400 })
    }
    const [dup] = await db.select({ id: users.id }).from(users)
      .where(sql`lower(${users.email}) = ${valid.email}`)
    if (dup && dup.id !== userId) {
      return NextResponse.json({ error: 'Ezzel az e-maillel már van fiók' }, { status: 409 })
    }
    const [user] = await db.update(users)
      .set({ email: valid.email, emailVerifiedAt: null })
      .where(eq(users.id, userId))
      .returning()
    const raw = newToken()
    await db.insert(authTokens).values({
      userId, kind: 'verify', tokenHash: hashToken(raw), expiresAt: tokenExpiry('verify'),
    })
    const mail = verifyEmailTemplate(raw, user.locale)
    await sendEmail(valid.email, mail.subject, mail.html)
  }

  // onboarding-wizard állapot (szerveroldali → több eszközön is tudott)
  if (body.onboardingDone !== undefined) {
    await upsert(userId, 'onboarding', { done: Boolean(body.onboardingDone) })
  }

  // publikus link: true = új token generálása, null = visszavonás
  if (body.publicToken !== undefined) {
    if (body.publicToken === null) {
      await upsert(userId, 'publicToken', null)
    } else {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map((b) => b.toString(16).padStart(2, '0')).join('')
      await upsert(userId, 'publicToken', token)
      return NextResponse.json({ ok: true, publicToken: token })
    }
  }

  if (body.tasteLikes !== undefined || body.tasteDislikes !== undefined) {
    const likes = String(body.tasteLikes ?? '')
    const dislikes = String(body.tasteDislikes ?? '')
    await upsert(userId, 'tasteLikes', likes)
    await upsert(userId, 'tasteDislikes', dislikes)

    // global taste lists live in taste_memory (animeId null, source=settings)
    await db.delete(tasteMemory).where(
      and(
        eq(tasteMemory.userId, userId),
        isNull(tasteMemory.animeId),
        eq(tasteMemory.source, 'settings'),
      ),
    )
    const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2)
    const rows = [
      ...toLines(likes).map((text) => ({ userId, kind: 'like', text, source: 'settings' })),
      ...toLines(dislikes).map((text) => ({ userId, kind: 'dislike', text, source: 'settings' })),
    ]
    if (rows.length) await db.insert(tasteMemory).values(rows)
  }

  return NextResponse.json({ ok: true })
}
