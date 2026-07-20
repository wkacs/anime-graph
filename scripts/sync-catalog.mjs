// Full/incremental AniList -> title sync. Throttled, idempotent.
// Run: node scripts/sync-catalog.mjs [--type=ANIME|MANGA] [--since=<anilistId>]
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const TYPE = args.type === 'MANGA' ? 'MANGA' : 'ANIME'
const SINCE = args.since ? Number(args.since) : 0

function slugify(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function sleepMsFor(remaining, resetInSec) {
  const resetMs = Math.max(0, resetInSec) * 1000
  if (remaining <= 0) return resetMs
  if (remaining > 10) return 0
  return Math.round(resetMs / remaining)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const QUERY = `
query ($page: Int!, $type: MediaType!, $idGt: Int!) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: $type, id_greater: $idGt, sort: ID) {
      id type idMal
      title { romaji english native }
      coverImage { large } bannerImage genres
      tags { name rank } studios { nodes { name } }
      season seasonYear episodes duration format chapters volumes
      description(asHtml: true) averageScore
      trailer { id site }
      relations { edges { relationType node { id type title { romaji } } } }
    }
  }
}`

async function fetchPage(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { page, type: TYPE, idGt: SINCE } }),
    })
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') || '60')
      console.log(`429 — sleeping ${retry}s`); await sleep(retry * 1000); continue
    }
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`)
    const remaining = Number(res.headers.get('x-ratelimit-remaining') || '90')
    const reset = 60
    const json = await res.json()
    if (json.errors?.length) throw new Error(json.errors[0].message)
    return { data: json.data.Page, waitMs: Math.max(700, sleepMsFor(remaining, reset)) }
  }
  throw new Error('too many 429s')
}

async function upsert(m) {
  const mediaType = m.type === 'MANGA' ? 'MANGA' : 'ANIME'
  const studio = m.studios?.nodes?.[0]?.name ?? null
  const relations = (m.relations?.edges ?? []).map((e) => ({
    type: e.relationType, anilistId: e.node.id, title: e.node.title.romaji,
  }))
  const slug = slugify(m.title.romaji) ? slugify(m.title.romaji) + '-' + m.id : 'title-' + m.id
  await sql`
    INSERT INTO title (anilist_id, mal_id, slug, media_type, title_romaji, title_english,
      title_native, cover_url, banner_url, genres, tags, studio, season, year, episodes,
      duration_min, format, chapters, volumes, description, relations, trailer_site,
      trailer_id, avg_score, synced_at)
    VALUES (${m.id}, ${m.idMal}, ${slug}, ${mediaType}, ${m.title.romaji}, ${m.title.english},
      ${m.title.native}, ${m.coverImage?.large ?? null}, ${m.bannerImage}, ${m.genres ?? []},
      ${JSON.stringify(m.tags ?? [])}, ${studio}, ${m.season}, ${m.seasonYear}, ${m.episodes},
      ${m.duration}, ${m.format}, ${m.chapters}, ${m.volumes}, ${m.description},
      ${JSON.stringify(relations)}, ${m.trailer?.site ?? null}, ${m.trailer?.id ?? null},
      ${m.averageScore}, now())
    ON CONFLICT (anilist_id, media_type) DO UPDATE SET
      mal_id = excluded.mal_id, cover_url = excluded.cover_url, banner_url = excluded.banner_url,
      genres = excluded.genres, tags = excluded.tags, studio = excluded.studio,
      episodes = excluded.episodes, chapters = excluded.chapters, volumes = excluded.volumes,
      description = excluded.description, relations = excluded.relations,
      avg_score = excluded.avg_score, synced_at = now()`
}

async function main() {
  let page = 1, total = 0
  for (;;) {
    const { data, waitMs } = await fetchPage(page)
    for (const m of data.media) { await upsert(m); total++ }
    console.log(`page ${page}: +${data.media.length} (total ${total})`)
    if (!data.pageInfo.hasNextPage) break
    page++
    await sleep(waitMs)
  }
  console.log(`sync done: ${total} ${TYPE} titles`)
}
main().catch((e) => { console.error(e); process.exit(1) })
