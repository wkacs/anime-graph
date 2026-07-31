const enc = new TextEncoder()

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const SESSION_DAYS = 30
/** a felezőpont után újítunk: az aktív user sosem esik ki, az inaktív token lejár */
export const SESSION_RENEW_AFTER_MS = (SESSION_DAYS / 2) * 86400_000

// session token: "<userId>.<tokenVersion>.<expiryMs>.<hmac>" — edge-safe (Web Crypto only).
// A tokenVersion a jelszó-resetnél nő, így a régi tokenek érvénytelenné válnak.
export async function createSession(
  secret: string, userId: number, tokenVersion: number, days = SESSION_DAYS,
): Promise<string> {
  if (!secret) throw new Error('A session aláírókulcsa nem lehet üres')
  const exp = Date.now() + days * 86400_000
  const payload = `${userId}.${tokenVersion}.${exp}`
  return `${payload}.${await hmacHex(secret, payload)}`
}

export type SessionClaims = { userId: number; tokenVersion: number; expiresAt: number }

export async function verifySession(
  secret: string, token: string | undefined,
): Promise<SessionClaims | null> {
  if (!secret || !token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [uid, ver, exp, sig] = parts
  const expected = await hmacHex(secret, `${uid}.${ver}.${exp}`)
  if (!/^[0-9a-f]{64}$/.test(sig) || !constantTimeEqual(expected, sig)) return null
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null
  const userId = Number(uid)
  const tokenVersion = Number(ver)
  if (!Number.isInteger(userId) || userId <= 0) return null
  if (!Number.isInteger(tokenVersion) || tokenVersion < 0) return null
  return { userId, tokenVersion, expiresAt: Number(exp) }
}
