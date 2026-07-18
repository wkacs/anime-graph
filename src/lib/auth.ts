const enc = new TextEncoder()
const SESSION_PAYLOAD = 'anime-graph-session-v1'

export async function sessionToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_PAYLOAD))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function isValidSession(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false
  return (await sessionToken(secret)) === token
}
