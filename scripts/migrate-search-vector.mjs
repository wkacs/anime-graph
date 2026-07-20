// Adds the full-text search vector + GIN index to title. Idempotent.
// Run: node scripts/migrate-search-vector.mjs
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })

async function main() {
  console.log('1/2 add generated search_vector column')
  await sql`
    ALTER TABLE title ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(title_romaji, '') || ' ' ||
        coalesce(title_english, '') || ' ' ||
        coalesce(title_native, ''))
    ) STORED`
  console.log('2/2 create GIN index')
  await sql`CREATE INDEX IF NOT EXISTS title_search_gin ON title USING GIN (search_vector)`
  console.log('done.')
}
main().catch((e) => { console.error(e); process.exit(1) })
