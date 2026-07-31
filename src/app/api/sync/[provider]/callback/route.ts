import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { syncAccounts } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { exchangeCode, fetchExternalUsername, isProvider } from '@/lib/sync-oauth'
import { constantTimeEqual } from '@/lib/auth'
import { encryptOAuthToken } from '@/lib/oauth-token-crypto'

export const dynamic = 'force-dynamic'

function back(req: NextRequest, provider: string, q: string) {
  const res = NextResponse.redirect(new URL(`/beallitasok?sync=${q}`, req.url))
  res.cookies.set(`sync_state_${provider}`, '', { httpOnly: true, maxAge: 0, path: '/' })
  res.cookies.set(`sync_verifier_${provider}`, '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
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
  if (!code) return back(req, provider, 'denied')
  // A flow-t minden providernél egy rövid életű, httpOnly cookie-hoz kötjük.
  // A MAL biztosan, az AniList újabb OAuth-válasza pedig ha küld state-et,
  // annak egyeznie kell a kriptográfiailag véletlen indítási értékkel.
  if (
    !savedState
    || (provider === 'mal' && !state)
    || (state != null && !constantTimeEqual(state, savedState))
  ) {
    return back(req, provider, 'state-mismatch')
  }

  try {
    const token = await exchangeCode(provider, req.nextUrl.origin, code, verifier)
    if (!token) return back(req, provider, 'error')
    const externalUsername = await fetchExternalUsername(provider, token.accessToken)
    const encryptedAccessToken = encryptOAuthToken(token.accessToken)
    const encryptedRefreshToken = token.refreshToken
      ? encryptOAuthToken(token.refreshToken)
      : null

    await db.insert(syncAccounts).values({
      userId,
      provider,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: token.expiresAt,
      externalUsername,
    }).onConflictDoUpdate({
      target: [syncAccounts.userId, syncAccounts.provider],
      set: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: token.expiresAt,
        externalUsername,
        createdAt: new Date(),
      },
    })

    return back(req, provider, 'ok')
  } catch {
    console.error('OAuth callback feldolgozása sikertelen:', { provider })
    return back(req, provider, 'error')
  }
}
