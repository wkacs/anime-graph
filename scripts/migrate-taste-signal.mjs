import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS taste_signal (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      title_id integer NOT NULL REFERENCES title(id) ON DELETE CASCADE,
      feature text NOT NULL,
      polarity integer NOT NULL,
      strength real NOT NULL DEFAULT 1,
      source text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  await sql`CREATE INDEX IF NOT EXISTS taste_signal_user ON taste_signal (user_id)`
  // egy cimre egy feature egyszer — ujra-extractalaskor felulirodik
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS taste_signal_unique
            ON taste_signal (user_id, title_id, feature)`
  console.log('migrate-taste-signal: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
