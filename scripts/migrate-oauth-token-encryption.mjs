import {
  createCipheriv, randomBytes,
} from 'node:crypto'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nincs beállítva')
const encodedKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim()
if (!encodedKey) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY nincs beállítva')
const keyEncoding = /[-_]/.test(encodedKey) ? 'base64url' : 'base64'
const key = Buffer.from(encodedKey, keyEncoding)
if (key.length !== 32) {
  throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY pontosan 32 bájtos base64 kulcs legyen')
}

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const aad = Buffer.from('anime-graph:oauth-token:v1')

function encrypt(value) {
  if (!value || value.startsWith('v1.')) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

const rows = await sql`
  SELECT id, access_token, refresh_token
  FROM sync_accounts
`
let migrated = 0
for (const row of rows) {
  if (row.access_token.startsWith('v1.')
    && (!row.refresh_token || row.refresh_token.startsWith('v1.'))) continue
  await sql`
    UPDATE sync_accounts
    SET access_token = ${encrypt(row.access_token)},
        refresh_token = ${encrypt(row.refresh_token)}
    WHERE id = ${row.id}
  `
  migrated++
}

console.log(`Titkosított OAuth-kapcsolatok: ${migrated}`)
