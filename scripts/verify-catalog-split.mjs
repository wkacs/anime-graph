// Post-migration integrity check. Run: node scripts/verify-catalog-split.mjs
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })

async function main() {
  const [{ ut }] = await sql`SELECT count(*)::int AS ut FROM user_title`
  const [{ t }] = await sql`SELECT count(*)::int AS t FROM title`
  const [{ v }] = await sql`SELECT count(*)::int AS v FROM anime`
  const [{ orphan }] = await sql`SELECT count(*)::int AS orphan FROM user_title WHERE title_id IS NULL`
  const [{ badfk }] = await sql`
    SELECT count(*)::int AS badfk FROM user_title ut
    LEFT JOIN title t ON t.id = ut.title_id WHERE t.id IS NULL`
  // the view row count must equal user_title (inner join over a NOT NULL FK)
  console.log({ userTitle: ut, title: t, animeView: v, orphan, badfk })
  if (orphan !== 0 || badfk !== 0 || v !== ut) {
    console.error('INTEGRITY FAIL'); process.exit(1)
  }
  console.log('integrity OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
