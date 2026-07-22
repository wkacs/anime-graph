import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
async function main() {
  await sql`CREATE TABLE IF NOT EXISTS title_recommendations (
    id serial PRIMARY KEY, anilist_id integer NOT NULL, rec_anilist_id integer NOT NULL,
    rating integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now())`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS title_rec_unique ON title_recommendations (anilist_id, rec_anilist_id)`
  await sql`CREATE TABLE IF NOT EXISTS api_cache (
    key text PRIMARY KEY, value jsonb NOT NULL, expires_at timestamp NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now())`
  console.log('migrate-catalog-cache: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
