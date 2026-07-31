import {
  createCipheriv, createDecipheriv, randomBytes,
} from 'node:crypto'

const PREFIX = 'v1'
const AAD = Buffer.from('anime-graph:oauth-token:v1')

export function oauthTokenEncryptionKey(
  value = process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
): Buffer {
  const encoded = value?.trim()
  if (!encoded) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY nincs beállítva')
  const encoding = /[-_]/.test(encoded) ? 'base64url' : 'base64'
  const key = Buffer.from(encoded, encoding)
  if (key.length !== 32) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY pontosan 32 bájtos base64 kulcs legyen')
  }
  return key
}

export function isEncryptedOAuthToken(value: string): boolean {
  return value.startsWith(`${PREFIX}.`)
}

export function encryptOAuthToken(
  plaintext: string,
  key = oauthTokenEncryptionKey(),
): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptOAuthToken(
  stored: string,
  key = oauthTokenEncryptionKey(),
): string {
  // Fejlesztésben olvasható marad a régi formátum, hogy a migráció előkészíthető
  // legyen. Productionben fail-closed: ott plaintext token sosem használható.
  if (!isEncryptedOAuthToken(stored)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Régi plaintext OAuth-token; futtasd a titkosítási migrációt')
    }
    return stored
  }
  const [version, ivPart, tagPart, ciphertextPart] = stored.split('.')
  if (version !== PREFIX || !ivPart || !tagPart || ciphertextPart == null) {
    throw new Error('Sérült OAuth-token formátum')
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    )
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('Az OAuth-token visszafejtése sikertelen')
  }
}
