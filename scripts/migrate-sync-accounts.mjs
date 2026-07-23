import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
async function main() {
  await sql`CREATE TABLE IF NOT EXISTS sync_accounts (
    id serial PRIMARY KEY,
    user_id integer NOT NULL,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp,
    external_username text,
    created_at timestamp NOT NULL DEFAULT now())`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS sync_account_user_provider ON sync_accounts (user_id, provider)`
  console.log('migrate-sync-accounts: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
