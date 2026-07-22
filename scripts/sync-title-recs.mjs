import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)
const Q = `query($id:Int){Media(id:$id,type:ANIME){recommendations(sort:RATING_DESC,perPage:10){nodes{rating mediaRecommendation{id}}}}}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchRecs(id) {
  for (let a = 0; a < 4; a++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: Q, variables: { id } }),
    })
    if (res.status === 429) { await sleep(60000); continue }
    if (!res.ok) return []
    const j = await res.json()
    return (j.data?.Media?.recommendations?.nodes ?? [])
      .filter((n) => n.mediaRecommendation?.id)
      .map((n) => ({ recAnilistId: n.mediaRecommendation.id, rating: n.rating ?? 0 }))
  }
  return []
}

async function main() {
  // csak a listákon szereplő címekre (fókuszált, nem a teljes 22k) — bővíthető
  const ids = (await sql`SELECT DISTINCT t.anilist_id FROM user_title ut JOIN title t ON t.id = ut.title_id WHERE t.media_type = 'ANIME'`).map((r) => r.anilist_id)
  console.log(`${ids.length} cím recs-szinkron`)
  let done = 0
  for (const id of ids) {
    const recs = await fetchRecs(id)
    for (const r of recs) {
      await sql`INSERT INTO title_recommendations (anilist_id, rec_anilist_id, rating)
        VALUES (${id}, ${r.recAnilistId}, ${r.rating})
        ON CONFLICT (anilist_id, rec_anilist_id) DO UPDATE SET rating = excluded.rating`
    }
    if (++done % 20 === 0) console.log(`${done}/${ids.length}`)
    await sleep(700) // ~85 req/min
  }
  console.log('sync-title-recs: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
