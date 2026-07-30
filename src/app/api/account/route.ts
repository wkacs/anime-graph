import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  aiUsageLog, animeStaff, authTokens, duels, episodeLog, favoriteCharacters, opinions,
  pushSubscriptions, recommendations, settings, syncAccounts, tasteMemory, tasteSignal,
  userTitle, users, watchlistItems,
} from '@/db/schema'
import { canDeleteAccount } from '@/lib/account'
import { verifyPassword } from '@/lib/password'
import { rateLimit } from '@/lib/rate-limit'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await rateLimit('account-delete', String(userId), 3, 3600))) {
    return NextResponse.json({ error: 'too many attempts' }, { status: 429 })
  }
  const body = await req.json().catch(() => null)
  if (!canDeleteAccount(body?.password, body?.confirmation)) {
    return NextResponse.json({ error: 'password and DELETE confirmation are required' }, { status: 400 })
  }
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId))
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return NextResponse.json({ error: 'invalid password' }, { status: 401 })
  }

  // A neon-http driver nem tud tranzakciót (runtime-hiba lenne), ezért a törlés
  // szekvenciális. Részleges hiba esetén a végpont újrahívható: minden lépés
  // idempotens, és a users-sor csak legvégül tűnik el.
  const titles = await db.select({ id: userTitle.id }).from(userTitle).where(eq(userTitle.userId, userId))
  const titleIds = titles.map((row) => row.id)
  if (titleIds.length) await db.delete(opinions).where(inArray(opinions.animeId, titleIds))

  await Promise.all([
    db.delete(authTokens).where(eq(authTokens.userId, userId)),
    db.delete(syncAccounts).where(eq(syncAccounts.userId, userId)),
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)),
    db.delete(watchlistItems).where(eq(watchlistItems.userId, userId)),
    db.delete(settings).where(eq(settings.userId, userId)),
    db.delete(tasteMemory).where(eq(tasteMemory.userId, userId)),
    db.delete(tasteSignal).where(eq(tasteSignal.userId, userId)),
    db.delete(favoriteCharacters).where(eq(favoriteCharacters.userId, userId)),
    db.delete(duels).where(eq(duels.userId, userId)),
    db.delete(episodeLog).where(eq(episodeLog.userId, userId)),
    db.delete(recommendations).where(eq(recommendations.userId, userId)),
    db.delete(aiUsageLog).where(eq(aiUsageLog.userId, userId)),
    db.delete(animeStaff).where(eq(animeStaff.userId, userId)),
  ])
  await db.delete(userTitle).where(eq(userTitle.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' })
  return res
}
