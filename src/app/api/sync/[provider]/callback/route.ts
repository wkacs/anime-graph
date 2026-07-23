import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { syncAccounts } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { exchangeCode, fetchExternalUsername, isProvider } from '@/lib/sync-oauth'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function back(req: NextRequest, q: string) {
  return NextResponse.redirect(new URL(`/beallitasok?sync=${q}`, req.url))
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.redirect(new URL('/login', req.url))
  const { provider } = await ctx.params
  if (!isProvider(provider)) return NextResponse.json({ error: 'ismeretlen provider' }, { status: 400 })

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const savedState = req.cookies.get(`sync_state_${provider}`)?.value
  const verifier = req.cookies.get(`sync_verifier_${provider}`)?.value ?? ''
  if (!code) return back(req, 'denied')
  // MAL küld state-et; AniList nem — csak ott ellenőrzünk, ahol van
  if (provider === 'mal' && (!state || state !== savedState)) return back(req, 'state-mismatch')

  const token = await exchangeCode(provider, req.nextUrl.origin, code, verifier)
  if (!token) return back(req, 'error')
  const externalUsername = await fetchExternalUsername(provider, token.accessToken)

  await db.delete(syncAccounts)
    .where(and(eq(syncAccounts.userId, userId), eq(syncAccounts.provider, provider)))
  await db.insert(syncAccounts).values({
    userId, provider,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    externalUsername,
  })

  const res = back(req, 'ok')
  res.cookies.delete(`sync_state_${provider}`)
  res.cookies.delete(`sync_verifier_${provider}`)
  return res
}
