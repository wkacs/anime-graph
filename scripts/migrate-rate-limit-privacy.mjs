import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL nincs beállítva')
}

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })

// A korábbi verzió az IP/e-mail azonosítót nyersen tette az rl:* kulcs végére.
// Csak a régi formátumot töröljük; az új kulcs scope + 64 hex HMAC alakú.
const removed = await sql`
  DELETE FROM api_cache
  WHERE key LIKE 'rl:%'
    AND key !~ '^rl:[^:]+:[0-9a-f]{64}$'
  RETURNING 1
`

console.log(`Régi rate-limit rekordok törölve: ${removed.length}`)
