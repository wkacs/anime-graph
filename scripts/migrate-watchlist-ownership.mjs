// One-off, idempotent migration for the P0 watchlist ownership fix.
// Run: node scripts/migrate-watchlist-ownership.mjs
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

function quoteIdentifier(name) {
  return `"${name.replaceAll('"', '""')}"`
}

async function main() {
  const [{ tableName }] = await sql`SELECT to_regclass('public.watchlist_items') AS "tableName"`
  if (!tableName) throw new Error('watchlist_items table is missing')

  await sql`ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS user_id integer`
  // The old global list recorded its original adder. Preserve that ownership so
  // existing entries appear only in that person's new personal list.
  await sql`UPDATE watchlist_items SET user_id = COALESCE(user_id, added_by, 1) WHERE user_id IS NULL`

  const [{ orphanCount }] = await sql`
    SELECT count(*)::int AS "orphanCount"
    FROM watchlist_items w
    LEFT JOIN users u ON u.id = w.user_id
    WHERE u.id IS NULL`
  if (orphanCount > 0) {
    throw new Error(`${orphanCount} watchlist rows have no valid owner; migration stopped`)
  }

  await sql`ALTER TABLE watchlist_items ALTER COLUMN user_id SET NOT NULL`
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'watchlist_items'::regclass
          AND conname = 'watchlist_items_user_id_users_id_fk'
      ) THEN
        ALTER TABLE watchlist_items
          ADD CONSTRAINT watchlist_items_user_id_users_id_fk
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$`

  // The former unique(anilist_id) made the list global. Remove only a single-
  // column unique constraint on anilist_id, retaining unrelated constraints.
  const uniqueConstraints = await sql`
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'watchlist_items'::regclass
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND c.conkey[1] = (
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = 'watchlist_items'::regclass AND a.attname = 'anilist_id'
      )`
  for (const { conname } of uniqueConstraints) {
    await sql.query(`ALTER TABLE watchlist_items DROP CONSTRAINT ${quoteIdentifier(conname)}`)
  }

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_user_anilist_unique
    ON watchlist_items (user_id, anilist_id)`
  await sql`
    CREATE INDEX IF NOT EXISTS watchlist_items_user_created_at
    ON watchlist_items (user_id, created_at DESC)`

  console.log('migrate-watchlist-ownership: OK')
}

main().catch((error) => { console.error(error); process.exit(1) })
