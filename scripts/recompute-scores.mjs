// Nightly: recompute community score/count/popularity per title. Idempotent.
// Run: node scripts/recompute-scores.mjs
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const PRIOR = 10

async function main() {
  // popularity = # of user_title rows; count/sum only over scored rows
  const agg = await sql`
    SELECT title_id,
      count(*)::int AS popularity,
      count(my_score)::int AS n,
      coalesce(sum(my_score), 0)::float AS s
    FROM user_title GROUP BY title_id`
  const scored = agg.filter((r) => r.n > 0)
  const globalMean = scored.length
    ? scored.reduce((a, r) => a + r.s, 0) / scored.reduce((a, r) => a + r.n, 0)
    : 7
  for (const r of agg) {
    const score = r.n > 0 ? (PRIOR * globalMean + r.s) / (PRIOR + r.n) : null
    await sql`
      UPDATE title SET community_score = ${score},
        community_count = ${r.n}, popularity = ${r.popularity}
      WHERE id = ${r.title_id}`
  }
  console.log(`recomputed ${agg.length} titles, globalMean=${globalMean.toFixed(3)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
