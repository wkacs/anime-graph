import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/session'
import { authorizeUrl, isProvider, randomToken } from '@/lib/sync-oauth'

export const dynamic = 'force-dynamic'

// OAuth-flow indítása: átirányít a provider engedélyező oldalára,
// a state+verifier rövid életű httpOnly sütiben utazik a callbackig.
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.redirect(new URL('/login', req.url))
  const { provider } = await ctx.params
  if (!isProvider(provider)) return NextResponse.json({ error: 'ismeretlen provider' }, { status: 400 })

  const state = randomToken(16)
  const verifier = randomToken(48)
  const url = authorizeUrl(provider, req.nextUrl.origin, state, verifier)
  if (!url) {
    return NextResponse.json({ error: `${provider.toUpperCase()}_CLIENT_ID nincs beállítva` }, { status: 501 })
  }
  const res = NextResponse.redirect(url)
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, maxAge: 600, path: '/' }
  res.cookies.set(`sync_state_${provider}`, state, cookieOpts)
  res.cookies.set(`sync_verifier_${provider}`, verifier, cookieOpts)
  return res
}
