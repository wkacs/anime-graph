import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`
  // reszleges index: a megle­vo, email nelkuli sorok (id=1) ne utkozzenek egymassal
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email)) WHERE email IS NOT NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind text NOT NULL,
      token_hash text NOT NULL,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_hash_unique ON auth_tokens (token_hash)`
  await sql`CREATE INDEX IF NOT EXISTS auth_tokens_user_kind ON auth_tokens (user_id, kind)`

  // a megle­vo izles-tenyek magyarul keszultek, ezert ez a default
  await sql`ALTER TABLE taste_memory ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'hu'`
  console.log('migrate-gate-a: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
