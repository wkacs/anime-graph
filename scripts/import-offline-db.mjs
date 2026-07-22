import { neon } from '@neondatabase/serverless'

const DB_URL = 'https://raw.githubusercontent.com/manami-project/anime-offline-database/master/anime-offline-database-minified.json'
const sql = neon(process.env.DATABASE_URL)

const idFrom = (sources, host) => {
  for (const s of sources) { const m = s.match(new RegExp(`${host}/anime/(\\d+)`)); if (m) return Number(m[1]) }
  return null
}
const KNOWN_GENRES = new Set(['action', 'adventure', 'comedy', 'drama', 'ecchi', 'fantasy', 'horror', 'mahou shoujo', 'mecha', 'music', 'mystery', 'psychological', 'romance', 'sci-fi', 'slice of life', 'sports', 'supernatural', 'thriller'])

function map(entry) {
  const anilistId = idFrom(entry.sources, 'anilist\\.co')
  if (anilistId == null) return null
  const tags = entry.tags ?? []
  const durSec = entry.duration?.unit === 'SECONDS' ? entry.duration?.value : undefined
  const relations = (entry.relatedAnime ?? []).map((u) => idFrom([u], 'anilist\\.co')).filter((x) => x != null).map((id) => ({ type: 'RELATED', anilistId: id, title: '' }))
  return {
    anilistId, malId: idFrom(entry.sources, 'myanimelist\\.net'),
    titleRomaji: entry.title, coverUrl: entry.picture ?? null,
    episodes: entry.episodes ?? null, season: entry.animeSeason?.season ?? null,
    year: entry.animeSeason?.year ?? null, studio: entry.studios?.[0] ?? null,
    durationMin: durSec ? Math.round(durSec / 60) : null,
    avgScore: entry.score?.median != null ? Math.round(entry.score.median * 10) : null,
    genres: tags.filter((t) => KNOWN_GENRES.has(t.toLowerCase())),
    tags: tags.map((name) => ({ name, rank: 0 })),
    relations,
    slug: `${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}-${anilistId}`,
  }
}

async function main() {
  console.log('letöltés:', DB_URL)
  const res = await fetch(DB_URL)
  if (!res.ok) throw new Error(`offline-db letöltés HTTP ${res.status}`)
  const json = await res.json()
  const rows = json.data.map(map).filter(Boolean)
  console.log(`${json.data.length} entry → ${rows.length} AniList-source-os`)

  const newIds = []
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    for (const r of chunk) {
      // GAP-FILL upsert: a katalógus már AniList-enrichelt (21900 title), ezért az offline-db
      // SOSEM ír felül meglévő értéket (COALESCE = csak NULL/üres mezőt tölt) — különben az
      // AniList extraLarge borítót az offline MAL-CDN thumbnail lefokozná. ÚJ cím = teljes insert.
      const res2 = await sql`
        INSERT INTO title (anilist_id, media_type, slug, title_romaji, cover_url, episodes,
          season, year, studio, duration_min, avg_score, genres, tags, relations, mal_id, synced_at)
        VALUES (${r.anilistId}, 'ANIME', ${r.slug}, ${r.titleRomaji}, ${r.coverUrl}, ${r.episodes},
          ${r.season}, ${r.year}, ${r.studio}, ${r.durationMin}, ${r.avgScore},
          ${r.genres}, ${JSON.stringify(r.tags)}, ${JSON.stringify(r.relations)}, ${r.malId}, now())
        ON CONFLICT (anilist_id, media_type) DO UPDATE SET
          cover_url = COALESCE(title.cover_url, excluded.cover_url),
          episodes = COALESCE(title.episodes, excluded.episodes),
          season = COALESCE(title.season, excluded.season),
          year = COALESCE(title.year, excluded.year),
          duration_min = COALESCE(title.duration_min, excluded.duration_min),
          studio = COALESCE(title.studio, excluded.studio),
          avg_score = COALESCE(title.avg_score, excluded.avg_score),
          genres = CASE WHEN cardinality(title.genres) = 0 THEN excluded.genres ELSE title.genres END,
          tags = CASE WHEN title.tags = '[]'::jsonb THEN excluded.tags ELSE title.tags END,
          relations = CASE WHEN title.relations = '[]'::jsonb THEN excluded.relations ELSE title.relations END,
          mal_id = COALESCE(title.mal_id, excluded.mal_id),
          synced_at = now()
        RETURNING (xmax = 0) AS inserted, anilist_id`
      if (res2[0]?.inserted) newIds.push(res2[0].anilist_id)
    }
    console.log(`upsert ${Math.min(i + CHUNK, rows.length)}/${rows.length}`)
  }
  console.log(`ÚJ id-k (${newIds.length}):`, JSON.stringify(newIds))
}
main().catch((e) => { console.error(e); process.exit(1) })
