// Elavult sorok frissitese ID szerint. A sync-catalog.mjs ev-szeletei a null
// startDate-u cimeket nem erik el — ez a script a synced_at alapjan szedi
// ossze oket, es id_in-batchekkel (50/keres) kerdezi le az AniListet.
// Ami a valaszbol hianyzik, az az AniListrol eltunt: synced_at-ot kap, hogy
// ne probalkozzunk vele ujra (is_adult marad, amit a katalogus-import adott).
// Run: node scripts/sync-stale.mjs [--days=2] [--dry]
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const DAYS = args.days ? Number(args.days) : 2
const DRY = 'dry' in args

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const QUERY = `
query ($ids: [Int!], $type: MediaType!) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: $type) {
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

function slugify(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function fetchBatch(ids, type) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { ids, type } }),
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
    const json = await res.json()
    if (json.errors?.length) throw new Error(json.errors[0].message)
    return json.data.Page.media
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

async function main() {
  const stale = await sql`
    SELECT anilist_id, media_type FROM title
    WHERE synced_at IS NULL OR synced_at < now() - (${String(DAYS)} || ' days')::interval
    ORDER BY media_type, anilist_id`
  const byType = { ANIME: [], MANGA: [] }
  for (const r of stale) byType[r.media_type]?.push(r.anilist_id)
  console.log(`stale: ${byType.ANIME.length} ANIME, ${byType.MANGA.length} MANGA (>${DAYS} nap)`)
  if (DRY) return

  for (const type of ['ANIME', 'MANGA']) {
    const ids = byType[type]
    let updated = 0
    const missing = []
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50)
      const media = await fetchBatch(chunk, type)
      for (const m of media) { await upsert(m); updated++ }
      const got = new Set(media.map((m) => m.id))
      missing.push(...chunk.filter((id) => !got.has(id)))
      console.log(`${type}: ${Math.min(i + 50, ids.length)}/${ids.length} feldolgozva`)
      await sleep(800)
    }
    if (missing.length) {
      await sql`UPDATE title SET synced_at = now()
        WHERE media_type = ${type} AND anilist_id = ANY(${missing})`
      console.log(`${type}: ${updated} frissitve, ${missing.length} mar nincs az AniListen: ${missing.join(', ')}`)
    } else {
      console.log(`${type}: ${updated} frissitve, mind megvan az AniListen`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
