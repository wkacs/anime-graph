// Full/incremental AniList -> title sync. Throttled, idempotent.
// Run: node scripts/sync-catalog.mjs [--type=ANIME|MANGA] [--from=YEAR] [--to=YEAR]
//
// AniList caps offset pagination at 5000 results per query (page 100 @ perPage 50),
// so a single sorted paginate cannot reach the full ~20k anime / ~150k manga. We
// slice the catalog by startDate YEAR (each year has < 5000 titles per media type)
// and paginate within each slice. Titles with a null startDate are not covered.
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const TYPE = args.type === 'MANGA' ? 'MANGA' : 'ANIME'
const FROM_YEAR = args.from ? Number(args.from) : 1940
const TO_YEAR = args.to ? Number(args.to) : new Date().getFullYear() + 1

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

// type/from/to are a safe enum + computed ints — inlined; page is the only variable.
function sliceQuery(type, from, to) {
  return `
query ($page: Int!) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ${type}, startDate_greater: ${from}, startDate_lesser: ${to}, sort: START_DATE) {
      id type idMal
      title { romaji english native }
      coverImage { large } bannerImage genres
      tags { name rank } studios { nodes { name } }
      season seasonYear episodes duration format chapters volumes
      description(asHtml: true) averageScore isAdult
      trailer { id site }
      relations { edges { relationType node { id type title { romaji } } } }
    }
  }
}`
}

async function fetchPage(query, page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { page } }),
    })
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') || '60')
      console.log(`429 — sleeping ${retry}s`); await sleep(retry * 1000); continue
    }
    if (res.status >= 500) {
      const wait = 2 ** attempt * 1000
      console.log(`${res.status} — retry ${attempt + 1}/5 in ${wait}ms`); await sleep(wait); continue
    }
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`)
    const remaining = Number(res.headers.get('x-ratelimit-remaining') || '90')
    const json = await res.json()
    if (json.errors?.length) throw new Error(json.errors[0].message)
    return { data: json.data.Page, waitMs: Math.max(700, sleepMsFor(remaining, 60)) }
  }
  throw new Error('too many retries (429/5xx)')
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
      trailer_id, is_adult, avg_score, synced_at)
    VALUES (${m.id}, ${m.idMal}, ${slug}, ${mediaType}, ${m.title.romaji}, ${m.title.english},
      ${m.title.native}, ${m.coverImage?.large ?? null}, ${m.bannerImage}, ${m.genres ?? []},
      ${JSON.stringify(m.tags ?? [])}, ${studio}, ${m.season}, ${m.seasonYear}, ${m.episodes},
      ${m.duration}, ${m.format}, ${m.chapters}, ${m.volumes}, ${m.description},
      ${JSON.stringify(relations)}, ${m.trailer?.site ?? null}, ${m.trailer?.id ?? null},
      ${m.isAdult ? 1 : 0}, ${m.averageScore}, now())
    ON CONFLICT (anilist_id, media_type) DO UPDATE SET
      mal_id = excluded.mal_id, cover_url = excluded.cover_url, banner_url = excluded.banner_url,
      genres = excluded.genres, tags = excluded.tags, studio = excluded.studio,
      episodes = excluded.episodes, chapters = excluded.chapters, volumes = excluded.volumes,
      description = excluded.description, relations = excluded.relations,
      is_adult = excluded.is_adult, avg_score = excluded.avg_score, synced_at = now()`
}

async function syncRange(from, to) {
  const query = sliceQuery(TYPE, from, to)
  let page = 1, count = 0, capped = false
  for (;;) {
    const { data, waitMs } = await fetchPage(query, page)
    for (const m of data.media) { await upsert(m); count++ }
    if (!data.pageInfo.hasNextPage) break
    if (page >= 100) { capped = true; break }
    page++
    await sleep(waitMs)
  }
  return { count, capped }
}

async function syncYear(year) {
  // startDate in [YYYY0000, YYYY1231]; -1 lower bound includes fuzzy year-only dates (YYYY0000).
  const { count, capped } = await syncRange(year * 10000 - 1, (year + 1) * 10000)
  if (!capped) return count
  // 5000-es lapozás-plafon: havi szeletekre váltás. A 0. szelet a csak-év fuzzy
  // dátumokat fedi (YYYY0000..YYYY0099), az 1-12. a hónapokat; a sávok diszjunktak
  // és uniójuk azonos az éves sávval (greater/lesser mindkét oldalt exkluzív).
  console.log(`  ${year}: hit 5000 cap — re-slicing by month`)
  let total = 0
  for (let m = 0; m <= 12; m++) {
    const from = year * 10000 + m * 100 - 1
    const to = m < 12 ? year * 10000 + (m + 1) * 100 : (year + 1) * 10000
    const r = await syncRange(from, to)
    if (r.capped) console.log(`  WARN ${year}-${String(m).padStart(2, '0')}: monthly slice ALSO hit 5000 cap`)
    total += r.count
  }
  return total
}

async function main() {
  let total = 0
  for (let year = FROM_YEAR; year <= TO_YEAR; year++) {
    const n = await syncYear(year)
    total += n
    if (n) console.log(`${TYPE} ${year}: +${n} (total ${total})`)
  }
  console.log(`sync done: ${total} ${TYPE} titles (years ${FROM_YEAR}-${TO_YEAR})`)
}
main().catch((e) => { console.error(e); process.exit(1) })
