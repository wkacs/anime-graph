// AniList-leírás a description-nélküli KATALÓGUS-sorokhoz (title tábla), 50-es batchekben.
// futtatás: node scripts/backfill-descriptions.mjs [--only-missing]  (DATABASE_URL env kell)
// Megjegyzés: a description az M1-split óta a `title` táblában él (az `anime` VIEW nem updatable).
// A script eleve csak a hiányzókat tölti; a --only-missing flag ezt teszi explicitté (alap viselkedés).
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const rows = await sql`SELECT anilist_id FROM title WHERE description IS NULL AND media_type = 'ANIME'`
const ids = rows.map((r) => r.anilist_id)
console.log(`${ids.length} title leírás nélkül`)

for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50)
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($ids: [Int!]) { Page(perPage: 50) { media(id_in: $ids) { id description } } }`,
      variables: { ids: batch },
    }),
  })
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  for (const m of json.data.Page.media) {
    if (m.description) {
      await sql`UPDATE title SET description = ${m.description} WHERE anilist_id = ${m.id} AND media_type = 'ANIME' AND description IS NULL`
    }
  }
  console.log(`${Math.min(i + 50, ids.length)}/${ids.length}`)
  await new Promise((r) => setTimeout(r, 700)) // AniList rate limit alatt maradunk
}
console.log('kész')
