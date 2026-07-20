// One-off catalog split. Idempotent: safe to re-run.
// Run: node scripts/migrate-catalog-split.mjs
// NOTE: destructive (renames anime -> user_title, drops legacy metadata columns).
// ALWAYS dry-run on a Neon BRANCH first, then verify-catalog-split.mjs, before prod.
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })

function slugify(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function main() {
  // Guard: if already migrated (user_title exists), stop.
  const done = await sql`SELECT to_regclass('public.user_title') AS t`
  if (done[0].t) { console.log('already migrated — user_title exists'); return }

  console.log('1/6 create title table')
  await sql`
    CREATE TABLE IF NOT EXISTS title (
      id serial PRIMARY KEY,
      anilist_id integer NOT NULL,
      mal_id integer,
      slug text NOT NULL,
      media_type text NOT NULL DEFAULT 'ANIME',
      title_romaji text NOT NULL,
      title_english text, title_native text,
      cover_url text, banner_url text,
      genres text[] NOT NULL DEFAULT '{}',
      tags jsonb NOT NULL DEFAULT '[]',
      studio text, season text, year integer,
      episodes integer, duration_min integer, format text,
      chapters integer, volumes integer, description text,
      relations jsonb NOT NULL DEFAULT '[]',
      trailer_site text, trailer_id text,
      avg_score integer,
      community_score real,
      community_count integer NOT NULL DEFAULT 0,
      popularity integer NOT NULL DEFAULT 0,
      synced_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`

  console.log('2/6 backfill title from distinct anime rows')
  // pick the lowest-id row per (anilist_id, media_type) as the metadata source
  const distinct = await sql`
    SELECT DISTINCT ON (anilist_id, media_type)
      anilist_id, media_type, title_romaji, title_english, title_native,
      cover_url, banner_url, genres, tags, studio, season, year, episodes,
      duration_min, format, chapters, volumes, description, relations,
      trailer_site, trailer_id, avg_score
    FROM anime
    ORDER BY anilist_id, media_type, id`
  for (const r of distinct) {
    const slug = slugify(r.title_romaji)
      ? slugify(r.title_romaji) + '-' + r.anilist_id
      : 'title-' + r.anilist_id
    await sql`
      INSERT INTO title (anilist_id, media_type, slug, title_romaji, title_english,
        title_native, cover_url, banner_url, genres, tags, studio, season, year,
        episodes, duration_min, format, chapters, volumes, description, relations,
        trailer_site, trailer_id, avg_score, synced_at)
      VALUES (${r.anilist_id}, ${r.media_type}, ${slug},
        ${r.title_romaji}, ${r.title_english}, ${r.title_native}, ${r.cover_url},
        ${r.banner_url}, ${r.genres}, ${JSON.stringify(r.tags)}, ${r.studio}, ${r.season},
        ${r.year}, ${r.episodes}, ${r.duration_min}, ${r.format}, ${r.chapters},
        ${r.volumes}, ${r.description}, ${JSON.stringify(r.relations)}, ${r.trailer_site},
        ${r.trailer_id}, ${r.avg_score}, now())
      ON CONFLICT (anilist_id, media_type) DO NOTHING`
  }
  console.log(`   inserted ${distinct.length} titles`)

  console.log('3/6 rename anime -> user_title, add title_id')
  await sql`ALTER TABLE anime RENAME TO user_title`
  await sql`ALTER TABLE user_title ADD COLUMN IF NOT EXISTS title_id integer`

  console.log('4/6 link user_title.title_id')
  await sql`
    UPDATE user_title ut
    SET title_id = t.id
    FROM title t
    WHERE t.anilist_id = ut.anilist_id AND t.media_type = ut.media_type`
  const orphan = await sql`SELECT count(*)::int AS n FROM user_title WHERE title_id IS NULL`
  if (orphan[0].n > 0) throw new Error(`${orphan[0].n} user_title rows have no title — aborting`)

  console.log('5/6 constrain title_id, drop legacy metadata columns')
  await sql`ALTER TABLE user_title ALTER COLUMN title_id SET NOT NULL`
  await sql`ALTER TABLE user_title ADD CONSTRAINT user_title_title_fk
            FOREIGN KEY (title_id) REFERENCES title(id) ON DELETE CASCADE`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_title_user_title_unique
            ON user_title (user_id, title_id)`
  for (const col of ['anilist_id', 'title_romaji', 'title_english', 'title_native', 'cover_url',
    'banner_url', 'genres', 'tags', 'studio', 'season', 'year', 'episodes', 'duration_min', 'format',
    'media_type', 'chapters', 'volumes', 'description', 'relations', 'trailer_site', 'trailer_id', 'avg_score']) {
    await sql.query(`ALTER TABLE user_title DROP COLUMN IF EXISTS ${col}`)
  }

  console.log('6/6 create anime compatibility view')
  await sql`
    CREATE OR REPLACE VIEW anime AS
    SELECT ut.id, ut.user_id, t.anilist_id, t.title_romaji, t.title_english,
      t.title_native, t.cover_url, t.banner_url, t.genres, t.tags, t.studio,
      t.season, t.year, t.episodes, t.duration_min, t.format, t.media_type,
      t.chapters, t.volumes, t.description, t.relations, t.trailer_site,
      t.trailer_id, t.avg_score, ut.status, ut.progress, ut.my_score,
      ut.elo, ut.rewatch_count, ut.watched_at, ut.created_at, ut.title_id
    FROM user_title ut JOIN title t ON t.id = ut.title_id`

  console.log('done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
