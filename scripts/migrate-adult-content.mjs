// Idempotent P1 migration for the catalog adult-content flag.
// Run: node scripts/migrate-adult-content.mjs
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`ALTER TABLE title ADD COLUMN IF NOT EXISTS is_adult integer NOT NULL DEFAULT 0`
  // A conservative immediate backfill for rows whose existing AniList tag says
  // Hentai. The subsequent catalog sync is authoritative for every title.
  await sql`
    UPDATE title
    SET is_adult = 1
    WHERE tags @> '[{"name":"Hentai"}]'::jsonb`
  await sql`CREATE INDEX IF NOT EXISTS title_public_sitemap_idx ON title (id) WHERE is_adult = 0`
  console.log('migrate-adult-content: OK')
}

main().catch((error) => { console.error(error); process.exit(1) })
