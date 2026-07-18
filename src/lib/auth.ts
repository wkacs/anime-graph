const enc = new TextEncoder()

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// session token: "<userId>.<expiryMs>.<hmac>" — edge-safe (Web Crypto only)
export async function createSession(secret: string, userId: number, days = 365): Promise<string> {
  const exp = Date.now() + days * 86400_000
  const payload = `${userId}.${exp}`
  return `${payload}.${await hmacHex(secret, payload)}`
}

export async function verifySession(secret: string, token: string | undefined): Promise<number | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [uid, exp, sig] = parts
  if ((await hmacHex(secret, `${uid}.${exp}`)) !== sig) return null
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null
  const id = Number(uid)
  return Number.isInteger(id) && id > 0 ? id : null
}
