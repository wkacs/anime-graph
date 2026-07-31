// OAuth-segédek a kétirányú szinkronhoz (D3). MAL: PKCE (plain), AniList: sima code grant.

import { randomBytes } from 'crypto'

export type Provider = 'mal' | 'anilist'

export function isProvider(p: string): p is Provider {
  return p === 'mal' || p === 'anilist'
}

export function appUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL ?? fallbackOrigin).replace(/\/+$/, '')
}

export function redirectUri(origin: string, provider: Provider): string {
  return `${appUrl(origin)}/api/sync/${provider}/callback`
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function authorizeUrl(provider: Provider, origin: string, state: string, verifier: string): string | null {
  if (provider === 'mal') {
    if (!process.env.MAL_CLIENT_ID) return null
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.MAL_CLIENT_ID,
      state,
      redirect_uri: redirectUri(origin, 'mal'),
      code_challenge: verifier, // MAL: plain method
      code_challenge_method: 'plain',
    })
    return `https://myanimelist.net/v1/oauth2/authorize?${q}`
  }
  if (!process.env.ANILIST_CLIENT_ID) return null
  const q = new URLSearchParams({
    client_id: process.env.ANILIST_CLIENT_ID,
    redirect_uri: redirectUri(origin, 'anilist'),
    response_type: 'code',
    state,
  })
  return `https://anilist.co/api/v2/oauth/authorize?${q}`
}

export type TokenResult = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
}

export async function exchangeCode(provider: Provider, origin: string, code: string, verifier: string): Promise<TokenResult | null> {
  if (provider === 'mal') {
    const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MAL_CLIENT_ID ?? '',
        client_secret: process.env.MAL_CLIENT_SECRET ?? '',
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri(origin, 'mal'),
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const j = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
    return {
      accessToken: j.access_token,
      refreshToken: j.refresh_token,
      expiresAt: new Date(Date.now() + j.expires_in * 1000),
    }
  }
  const res = await fetch('https://anilist.co/api/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.ANILIST_CLIENT_ID ?? '',
      client_secret: process.env.ANILIST_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(origin, 'anilist'),
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const j = await res.json() as { access_token: string }
  return { accessToken: j.access_token, refreshToken: null, expiresAt: null } // AniList-token ~1 évig él
}

export async function fetchExternalUsername(provider: Provider, accessToken: string): Promise<string | null> {
  try {
    if (provider === 'mal') {
      const res = await fetch('https://api.myanimelist.net/v2/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return null
      return ((await res.json()) as { name?: string }).name ?? null
    }
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{Viewer{name}}' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return ((await res.json()) as { data?: { Viewer?: { name?: string } } }).data?.Viewer?.name ?? null
  } catch {
    return null
  }
}
