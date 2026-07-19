// egyszeri backfill: rendezők minden anime-sorhoz, aminek még nincs staffja
// futtatás: node scripts/backfill-staff.mjs  (DATABASE_URL env kell)
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const rows = await sql`
  SELECT a.id, a.user_id, a.anilist_id FROM anime a
  WHERE NOT EXISTS (SELECT 1 FROM anime_staff s WHERE s.anime_id = a.id)`
console.log(`${rows.length} sor staff nélkül`)

const uniqueIds = [...new Set(rows.map((r) => r.anilist_id))]
const staffByAnilist = new Map()
for (let i = 0; i < uniqueIds.length; i += 50) {
  const batch = uniqueIds.slice(i, i + 50)
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($ids: [Int!]) { Page(perPage: 50) { media(id_in: $ids) {
        id staff(perPage: 12, sort: RELEVANCE) { edges { role node { id name { full } image { medium } } } }
      } } }`,
      variables: { ids: batch },
    }),
  })
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  for (const m of json.data.Page.media) {
    staffByAnilist.set(m.id, m.staff.edges
      .filter((e) => e.role === 'Director')
      .map((e) => ({ staffId: e.node.id, name: e.node.name.full, image: e.node.image?.medium ?? null })))
  }
  console.log(`AniList: ${Math.min(i + 50, uniqueIds.length)}/${uniqueIds.length}`)
  await new Promise((r) => setTimeout(r, 700)) // rate limit alatt maradunk
}

let inserted = 0
for (const row of rows) {
  for (const d of staffByAnilist.get(row.anilist_id) ?? []) {
    await sql`INSERT INTO anime_staff (user_id, anime_id, staff_id, name, image, role)
      VALUES (${row.user_id}, ${row.id}, ${d.staffId}, ${d.name}, ${d.image}, 'Director')
      ON CONFLICT DO NOTHING`
    inserted++
  }
}
console.log(`kész — ${inserted} staff-sor`)
