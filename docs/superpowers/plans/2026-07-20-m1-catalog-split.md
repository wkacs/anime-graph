# M1 — Catalog Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the per-user `anime` table into a global `title` catalog + a per-user `user_title` list, so every anime/manga exists once globally (public pages, community scores, no per-user metadata duplication) — the foundation the public-MAL milestones (M2–M7) all depend on.

**Architecture:** Introduce a global `title` table (one row per AniList title) holding all metadata, and repurpose the existing `anime` rows into a `user_title` table holding only user-owned fields (`status`, `progress`, `myScore`, `elo`, `rewatchCount`, `watchedAt`) plus a `title_id` FK. **The physical row `id` is preserved** across the migration, so the six FKs that point at `anime.id` (`opinions`, `taste_memory`, `favorite_characters`, `duels`, `episode_log`, `anime_staff`) stay valid untouched. A Postgres **compatibility view named `anime`** re-joins `user_title ⋈ title` into the exact old flat column shape, so the ~70 read-only call sites keep working with zero changes; only the ~6 write sites are migrated to a small write-repo module. Two background workers then populate `title` for the whole AniList catalog and recompute community scores.

**Tech Stack:** Next.js 15 (App Router), Drizzle ORM, Neon serverless Postgres, `drizzle-orm/neon-http`, vitest (pure-logic unit tests only — no DB integration tests in this repo), plain `.mjs` node scripts for migrations/workers (matches existing `scripts/backfill-*.mjs`), AniList GraphQL as metadata source.

## Global Constraints

- **Neon HTTP no-store:** every DB access goes through `@/db/client` (`db`), which already sets `fetchOptions: { cache: 'no-store' }`. Never call `neon()` directly in route code.
- **Lazy DB init:** never call `db` at module top level in route files (build-time page-data collection imports routes before env is guaranteed). Only inside handlers/functions.
- **AniList rate limit:** 90 requests/min. Any batch loop against AniList MUST throttle (≥ 700 ms between requests) and handle HTTP 429 with backoff. Never fire unbounded parallel fetches.
- **UI language:** existing UI strings are Hungarian; keep any new user-facing string Hungarian for now (i18n is milestone M3, out of scope here).
- **AI-content docs:** no em-dash / no " - " dash in any user-facing copy this project ships (house rule). Not relevant to code, but applies if any seed copy is added.
- **`id` preservation is mandatory.** Any step that would reassign `user_title.id` is a plan failure — the six dependent FKs rely on the old `anime.id` values.
- **Idempotent migration/workers.** The migration script and both workers must be safe to re-run (use `IF NOT EXISTS`, `ON CONFLICT`, watermark checks).

---

## File Structure

**New files:**
- `scripts/migrate-catalog-split.mjs` — one-off raw-SQL migration: create `title`, backfill from `anime`, add `title_id`, create the `anime` compatibility view. Idempotent.
- `scripts/verify-catalog-split.mjs` — post-migration integrity check (row counts, FK validity, no orphans).
- `scripts/sync-catalog.mjs` — throttled AniList full/incremental catalog sync into `title`.
- `scripts/recompute-scores.mjs` — nightly community-score / popularity recompute.
- `src/lib/catalog.ts` — pure helpers: `mapTitle()`, `slugify()`, `titleSlug()`. Unit-tested.
- `src/lib/catalog.test.ts` — tests for `catalog.ts`.
- `src/lib/community-score.ts` — pure `bayesianScore()` helper. Unit-tested.
- `src/lib/community-score.test.ts` — tests for `community-score.ts`.
- `src/lib/anime-write.ts` — write-repo: all inserts/updates/deletes against `user_title` (+ ensure `title` row). The 6 write sites call this instead of writing `anime` directly.

**Modified files:**
- `src/db/schema.ts` — add `title`, `userTitle` table objects + `anime` becomes a read view object; add new metadata columns to `title`.
- `src/app/api/anime/route.ts` — POST uses `anime-write`.
- `src/app/api/anime/[id]/route.ts` — PATCH/DELETE use `anime-write`.
- `src/app/api/anime/restore/route.ts` — uses `anime-write`.
- `src/lib/import-upsert.ts` — uses `anime-write`.
- `.github/workflows/*` (cron) — add scheduled invocations of the two workers (final task).

**Untouched (read via compatibility view):** all other ~70 files that `db.select().from(anime)` — verified, not edited.

---

## Task 1: Pure catalog helpers (`mapTitle`, `slugify`, `titleSlug`)

**Files:**
- Create: `src/lib/catalog.ts`
- Test: `src/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `AnilistMedia` type from `@/lib/anilist`, `TagEntry`/`RelationEntry` from `@/db/schema`.
- Produces:
  - `slugify(s: string): string` — lowercased, ascii-folded, `[^a-z0-9]+`→`-`, trimmed dashes.
  - `titleSlug(titleRomaji: string, anilistId: number): string` → `${slugify(titleRomaji)}-${anilistId}` (globally unique because anilistId is appended).
  - `mapTitle(m: AnilistMedia): TitleMetadata` where `TitleMetadata` = the metadata column set of the new `title` table (no user fields), derived from the AniList media object.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/catalog.test.ts
import { describe, it, expect } from 'vitest'
import { slugify, titleSlug, mapTitle } from './catalog'
import type { AnilistMedia } from './anilist'

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugify('Fullmetal Alchemist: Brotherhood')).toBe('fullmetal-alchemist-brotherhood')
  })
  it('folds accents and trims dashes', () => {
    expect(slugify('  Évángelion!! ')).toBe('evangelion')
  })
  it('never returns empty for non-empty input', () => {
    expect(slugify('★')).toBe('')
  })
})

describe('titleSlug', () => {
  it('appends anilistId for global uniqueness', () => {
    expect(titleSlug('Naruto', 20)).toBe('naruto-20')
  })
})

describe('mapTitle', () => {
  const media: AnilistMedia = {
    id: 5114, type: 'ANIME',
    title: { romaji: 'Hagane no Renkinjutsushi', english: 'FMA: Brotherhood', native: '鋼の錬金術師' },
    coverImage: { large: 'cover.jpg' }, bannerImage: 'banner.jpg',
    genres: ['Action'], tags: [{ name: 'Military', rank: 90 }],
    studios: { nodes: [{ name: 'Bones' }] },
    season: 'SPRING', seasonYear: 2009, episodes: 64, duration: 24, format: 'TV',
    description: 'desc', chapters: null, volumes: null, averageScore: 91,
    trailer: { id: 'abc', site: 'youtube' },
    relations: { edges: [{ relationType: 'PREQUEL', node: { id: 121, type: 'ANIME', title: { romaji: 'X' } } }] },
  }
  it('extracts global metadata with mediaType and slug', () => {
    const t = mapTitle(media)
    expect(t.anilistId).toBe(5114)
    expect(t.mediaType).toBe('ANIME')
    expect(t.slug).toBe('hagane-no-renkinjutsushi-5114')
    expect(t.studio).toBe('Bones')
    expect(t.avgScore).toBe(91)
    expect(t.tags).toEqual([{ name: 'Military', rank: 90 }])
    expect(t.trailerSite).toBe('youtube')
    expect(t.trailerId).toBe('abc')
  })
  it('defaults mediaType to ANIME when type is null', () => {
    expect(mapTitle({ ...media, type: null }).mediaType).toBe('ANIME')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/catalog.test.ts`
Expected: FAIL — "Cannot find module './catalog'".

- [ ] **Step 3: Write `src/lib/catalog.ts`**

```typescript
import type { AnilistMedia } from './anilist'
import type { TagEntry, RelationEntry } from '@/db/schema'

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')  // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function titleSlug(titleRomaji: string, anilistId: number): string {
  const base = slugify(titleRomaji)
  return base ? `${base}-${anilistId}` : `title-${anilistId}`
}

export type TitleMetadata = {
  anilistId: number
  mediaType: string
  slug: string
  titleRomaji: string
  titleEnglish: string | null
  titleNative: string | null
  coverUrl: string | null
  bannerUrl: string | null
  genres: string[]
  tags: TagEntry[]
  studio: string | null
  season: string | null
  year: number | null
  episodes: number | null
  durationMin: number | null
  format: string | null
  chapters: number | null
  volumes: number | null
  description: string | null
  relations: RelationEntry[]
  trailerSite: string | null
  trailerId: string | null
  avgScore: number | null
}

export function mapTitle(m: AnilistMedia): TitleMetadata {
  const mediaType = m.type === 'MANGA' ? 'MANGA' : 'ANIME'
  return {
    anilistId: m.id,
    mediaType,
    slug: titleSlug(m.title.romaji, m.id),
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    titleNative: m.title.native,
    coverUrl: m.coverImage?.large ?? null,
    bannerUrl: m.bannerImage,
    genres: m.genres ?? [],
    tags: m.tags ?? [],
    studio: m.studios?.nodes?.[0]?.name ?? null,
    season: m.season,
    year: m.seasonYear,
    episodes: m.episodes,
    durationMin: m.duration,
    format: m.format,
    chapters: m.chapters,
    volumes: m.volumes,
    description: m.description,
    relations: (m.relations?.edges ?? []).map((e) => ({
      type: e.relationType, anilistId: e.node.id, title: e.node.title.romaji,
    })),
    trailerSite: m.trailer?.site ?? null,
    trailerId: m.trailer?.id ?? null,
    avgScore: m.averageScore,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/catalog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog.ts src/lib/catalog.test.ts
git commit -m "feat(catalog): pure title-metadata + slug helpers"
```

---

## Task 2: Bayesian community-score helper

**Files:**
- Create: `src/lib/community-score.ts`
- Test: `src/lib/community-score.test.ts`

**Interfaces:**
- Produces: `bayesianScore(sum: number, n: number, globalMean: number, prior?: number): number | null` — MAL-style weighted score pulling low-vote titles toward the global mean. Returns `null` when `n === 0`. `prior` defaults to `10`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/community-score.test.ts
import { describe, it, expect } from 'vitest'
import { bayesianScore } from './community-score'

describe('bayesianScore', () => {
  it('returns null with no votes', () => {
    expect(bayesianScore(0, 0, 7)).toBeNull()
  })
  it('pulls a single high vote toward the global mean', () => {
    // one 10 vote, global mean 7, prior 10 -> (10*7 + 10)/(10+1) = 80/11 ≈ 7.27
    expect(bayesianScore(10, 1, 7)).toBeCloseTo(7.2727, 3)
  })
  it('approaches the raw mean as n grows', () => {
    // 1000 votes averaging 9 -> close to 9
    expect(bayesianScore(9000, 1000, 7)).toBeCloseTo(8.98, 2)
  })
  it('respects a custom prior', () => {
    expect(bayesianScore(10, 1, 7, 1)).toBeCloseTo(8.5, 3) // (1*7+10)/2
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/community-score.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/community-score.ts`**

```typescript
// MAL-style weighted rating: low-vote titles are pulled toward the global mean
// so a single 10/10 does not top the chart. prior = strength of that pull.
export function bayesianScore(
  sum: number, n: number, globalMean: number, prior = 10,
): number | null {
  if (n <= 0) return null
  return (prior * globalMean + sum) / (prior + n)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/community-score.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/community-score.ts src/lib/community-score.test.ts
git commit -m "feat(scores): bayesian community-score helper"
```

---

## Task 3: Schema — `title` + `userTitle` tables and `anime` read view

**Files:**
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces (drizzle objects, imported by later tasks):
  - `title` — pgTable `'title'`, PK `id`, columns per body below, `uniqueIndex('title_anilist_type_unique').on(anilistId, mediaType)`, `uniqueIndex('title_slug_unique').on(slug)`.
  - `userTitle` — pgTable `'user_title'`, PK `id`, `titleId` → `title.id`, user fields, `uniqueIndex('user_title_user_title_unique').on(userId, titleId)`.
  - `anime` — pgView `'anime'` exposing the OLD flat columns (used by read call sites; **select-only**).
  - Types `TitleInsert = typeof title.$inferInsert`, `UserTitleInsert = typeof userTitle.$inferInsert`.
- The old `anime` pgTable object is **replaced** by the view object; the physical table is renamed to `user_title` by the migration (Task 4). The six FK tables keep referencing the same physical `id`s.

- [ ] **Step 1: Edit `src/db/schema.ts` — add imports for `pgView`**

Change the top import to include `pgView`:

```typescript
import {
  pgTable, pgView, serial, integer, text, timestamp, jsonb, real,
  uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'
```

- [ ] **Step 2: Replace the `anime` pgTable block with `title` + `userTitle` + `anime` view**

Delete the current `export const anime = pgTable('anime', {...})` block (lines 16–53) and insert:

```typescript
// GLOBAL catalog: one row per AniList title, shared across all users.
export const title = pgTable('title', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull(),
  malId: integer('mal_id'),
  slug: text('slug').notNull(),
  mediaType: text('media_type').notNull().default('ANIME'), // ANIME | MANGA
  titleRomaji: text('title_romaji').notNull(),
  titleEnglish: text('title_english'),
  titleNative: text('title_native'),
  coverUrl: text('cover_url'),
  bannerUrl: text('banner_url'),
  genres: text('genres').array().notNull().default([]),
  tags: jsonb('tags').$type<TagEntry[]>().notNull().default([]),
  studio: text('studio'),
  season: text('season'),
  year: integer('year'),
  episodes: integer('episodes'),
  durationMin: integer('duration_min'),
  format: text('format'),
  chapters: integer('chapters'),
  volumes: integer('volumes'),
  description: text('description'),
  relations: jsonb('relations').$type<RelationEntry[]>().notNull().default([]),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  avgScore: integer('avg_score'),               // AniList average (external)
  communityScore: real('community_score'),        // our bayesian score, null until computed
  communityCount: integer('community_count').notNull().default(0),
  popularity: integer('popularity').notNull().default(0), // # of user_title rows
  syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('title_anilist_type_unique').on(t.anilistId, t.mediaType),
  uniqueIndex('title_slug_unique').on(t.slug),
])

// PER-USER list. id is preserved from the pre-split `anime` table so the
// six FK tables (opinions, taste_memory, favorite_characters, duels,
// episode_log, anime_staff) that reference it stay valid.
export const userTitle = pgTable('user_title', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  titleId: integer('title_id').notNull().references(() => title.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('planned'), // watching | completed | dropped | planned
  progress: integer('progress').notNull().default(0),
  myScore: integer('my_score'),
  elo: real('elo').notNull().default(1200),
  rewatchCount: integer('rewatch_count').notNull().default(0),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('user_title_user_title_unique').on(t.userId, t.titleId),
])

// COMPATIBILITY VIEW: same flat column shape the old `anime` table had, so the
// ~70 read-only call sites keep working. SELECT-ONLY — writes go via anime-write.ts.
export const anime = pgView('anime', {
  id: integer('id'),
  userId: integer('user_id'),
  anilistId: integer('anilist_id'),
  titleRomaji: text('title_romaji'),
  titleEnglish: text('title_english'),
  titleNative: text('title_native'),
  coverUrl: text('cover_url'),
  bannerUrl: text('banner_url'),
  genres: text('genres').array(),
  tags: jsonb('tags').$type<TagEntry[]>(),
  studio: text('studio'),
  season: text('season'),
  year: integer('year'),
  episodes: integer('episodes'),
  durationMin: integer('duration_min'),
  format: text('format'),
  mediaType: text('media_type'),
  chapters: integer('chapters'),
  volumes: integer('volumes'),
  description: text('description'),
  relations: jsonb('relations').$type<RelationEntry[]>(),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  avgScore: integer('avg_score'),
  status: text('status'),
  progress: integer('progress'),
  myScore: integer('my_score'),
  elo: real('elo'),
  rewatchCount: integer('rewatch_count'),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at'),
  titleId: integer('title_id'),
}).existing()
```

- [ ] **Step 3: Update the exported types at the bottom of the file**

Replace:

```typescript
export type AnimeSelect = typeof anime.$inferSelect
export type AnimeInsert = typeof anime.$inferInsert
```

with:

```typescript
export type TitleInsert = typeof title.$inferInsert
export type UserTitleInsert = typeof userTitle.$inferInsert
// AnimeSelect stays available for read call sites via the compat view.
export type AnimeSelect = typeof anime.$inferSelect
```

> Note: `AnimeInsert` is intentionally removed — nothing should insert into the view. Tasks 5–8 replace its two importers (`import-upsert.ts`, `anime/restore/route.ts`).

- [ ] **Step 4: Typecheck (expect errors only in the write sites we migrate next)**

Run: `npx tsc --noEmit`
Expected: errors limited to `AnimeInsert` importers — `src/lib/import-upsert.ts` and `src/app/api/anime/restore/route.ts` (fixed in Tasks 5 & 7). No other file should error, because read sites use the `anime` view with the same column names.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(schema): title + user_title tables, anime compat view"
```

---

## Task 4: Migration + verification scripts

**Files:**
- Create: `scripts/migrate-catalog-split.mjs`
- Create: `scripts/verify-catalog-split.mjs`

**Interfaces:**
- Consumes: `DATABASE_URL`, `@neondatabase/serverless`.
- Produces: physical `title` table populated + deduped; physical table `anime` renamed → `user_title` with a new `title_id` FK; a DB view `anime` re-exposing the old shape. Idempotent.

- [ ] **Step 1: Write `scripts/migrate-catalog-split.mjs`**

```javascript
// One-off catalog split. Idempotent: safe to re-run.
// Run: node scripts/migrate-catalog-split.mjs
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })

function slugify(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function main() {
  // Guard: if already migrated (view exists), stop.
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
    await sql`
      INSERT INTO title (anilist_id, media_type, slug, title_romaji, title_english,
        title_native, cover_url, banner_url, genres, tags, studio, season, year,
        episodes, duration_min, format, chapters, volumes, description, relations,
        trailer_site, trailer_id, avg_score, synced_at)
      VALUES (${r.anilist_id}, ${r.media_type},
        ${slugify(r.title_romaji) ? slugify(r.title_romaji) + '-' + r.anilist_id : 'title-' + r.anilist_id},
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
  for (const col of ['anilist_id','title_romaji','title_english','title_native','cover_url',
    'banner_url','genres','tags','studio','season','year','episodes','duration_min','format',
    'media_type','chapters','volumes','description','relations','trailer_site','trailer_id','avg_score']) {
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
```

- [ ] **Step 2: Write `scripts/verify-catalog-split.mjs`**

```javascript
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
```

- [ ] **Step 3: Dry-run on a branch DB (Neon branch), then verify**

Create a Neon branch of prod, point `DATABASE_URL` at it, then:

Run: `node scripts/migrate-catalog-split.mjs && node scripts/verify-catalog-split.mjs`
Expected: migration prints `1/6 … done.`, verify prints `integrity OK` with `animeView === userTitle` and `orphan===0, badfk===0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-catalog-split.mjs scripts/verify-catalog-split.mjs
git commit -m "feat(migration): catalog split migration + verify scripts"
```

---

## Task 5: Write-repo module (`anime-write.ts`)

**Files:**
- Create: `src/lib/anime-write.ts`

**Interfaces:**
- Consumes: `db`, `title`, `userTitle` from schema; `mapTitle` from `@/lib/catalog`; `AnilistMedia`.
- Produces:
  - `ensureTitle(m: AnilistMedia): Promise<number>` — upsert into `title`, return `title.id`.
  - `ensureTitleByFields(meta: TitleMetadata): Promise<number>` — same, from an already-mapped metadata object (used by importer/restore which map many rows).
  - `addUserTitle(userId, titleId, fields): Promise<AnimeRow>` — insert one `user_title` row (planned/status), return the joined flat row.
  - `updateUserTitle(userId, userTitleId, patch): Promise<AnimeRow>` — update owned row, return joined flat row.
  - `deleteUserTitle(userId, userTitleId): Promise<void>`.
  - `joinedRow(userTitleId): Promise<AnimeRow>` — re-read one row through the `anime` view shape.
  - `AnimeRow` = `AnimeSelect` (the view row type).

- [ ] **Step 1: Write `src/lib/anime-write.ts`**

```typescript
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { anime, title, userTitle } from '@/db/schema'
import { mapTitle, type TitleMetadata } from '@/lib/catalog'
import type { AnilistMedia } from '@/lib/anilist'

export type AnimeRow = typeof anime.$inferSelect

export async function ensureTitleByFields(meta: TitleMetadata): Promise<number> {
  const [row] = await db.insert(title).values(meta)
    .onConflictDoUpdate({
      target: [title.anilistId, title.mediaType],
      set: { syncedAt: sql`now()` }, // touch; full refresh is the sync worker's job
    })
    .returning({ id: title.id })
  return row.id
}

export function ensureTitle(m: AnilistMedia): Promise<number> {
  return ensureTitleByFields(mapTitle(m))
}

export async function joinedRow(userTitleId: number): Promise<AnimeRow> {
  const [row] = await db.select().from(anime).where(eq(anime.id, userTitleId))
  return row
}

export async function addUserTitle(
  userId: number, titleId: number,
  fields: { status: string; watchedAt: Date | null },
): Promise<AnimeRow> {
  const [ut] = await db.insert(userTitle)
    .values({ userId, titleId, status: fields.status, watchedAt: fields.watchedAt })
    .onConflictDoNothing({ target: [userTitle.userId, userTitle.titleId] })
    .returning({ id: userTitle.id })
  // onConflictDoNothing returns nothing if it already existed → fetch it
  const id = ut?.id ?? (await db.select({ id: userTitle.id }).from(userTitle)
    .where(and(eq(userTitle.userId, userId), eq(userTitle.titleId, titleId))))[0].id
  return joinedRow(id)
}

export async function updateUserTitle(
  userId: number, userTitleId: number, patch: Record<string, unknown>,
): Promise<AnimeRow | null> {
  const [ut] = await db.update(userTitle).set(patch)
    .where(and(eq(userTitle.id, userTitleId), eq(userTitle.userId, userId)))
    .returning({ id: userTitle.id })
  if (!ut) return null
  return joinedRow(ut.id)
}

export async function deleteUserTitle(userId: number, userTitleId: number): Promise<void> {
  await db.delete(userTitle)
    .where(and(eq(userTitle.id, userTitleId), eq(userTitle.userId, userId)))
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `anime-write.ts` (the pre-existing `AnimeInsert` errors in `import-upsert.ts` / `restore` remain until Tasks 6–7).

- [ ] **Step 3: Commit**

```bash
git add src/lib/anime-write.ts
git commit -m "feat(anime-write): user_title write-repo over title catalog"
```

---

## Task 6: Migrate `import-upsert.ts` to the catalog

**Files:**
- Modify: `src/lib/import-upsert.ts`

**Interfaces:**
- Consumes: `ensureTitleByFields` from `@/lib/anime-write`, `TitleMetadata` from `@/lib/catalog`.
- Produces: `upsertImported(userId, metas: TitleMetadata[], userFields: PerRow[]): Promise<{ added: number; updated: number }>` — the importers now pass mapped `TitleMetadata` + the per-row user fields, instead of the old flat `AnimeInsert[]`.

> Context: callers are `src/app/api/import/anilist/route.ts` and `src/app/api/import/mal/route.ts`. They currently build `AnimeInsert[]`. After this task they build `{ meta: TitleMetadata, user: { status, myScore, progress, watchedAt } }[]`. Their mapping already produces AniList media → adjust to `mapTitle` + split user fields. Update both callers in this task's Step 3.

- [ ] **Step 1: Rewrite `src/lib/import-upsert.ts`**

```typescript
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { title, userTitle } from '@/db/schema'
import { ensureTitleByFields } from '@/lib/anime-write'
import type { TitleMetadata } from '@/lib/catalog'

export type ImportRow = {
  meta: TitleMetadata
  user: { status: string; myScore: number | null; progress: number; watchedAt: Date | null }
}

// per row: ensure the global title exists, then upsert the user_title.
// existing user rows keep watched_at when the incoming value is null.
export async function upsertImported(
  userId: number, rows: ImportRow[],
): Promise<{ added: number; updated: number }> {
  let added = 0, updated = 0
  for (const { meta, user } of rows) {
    const titleId = await ensureTitleByFields(meta)
    const existing = await db.select({ id: userTitle.id }).from(userTitle)
      .where(and(eq(userTitle.userId, userId), eq(userTitle.titleId, titleId)))
    if (existing.length) updated++; else added++
    await db.insert(userTitle)
      .values({ userId, titleId, status: user.status, myScore: user.myScore,
        progress: user.progress, watchedAt: user.watchedAt })
      .onConflictDoUpdate({
        target: [userTitle.userId, userTitle.titleId],
        set: {
          status: sql`excluded.status`,
          myScore: sql`excluded.my_score`,
          progress: sql`excluded.progress`,
          watchedAt: sql`coalesce(excluded.watched_at, ${userTitle.watchedAt})`,
        },
      })
  }
  return { added, updated }
}
```

- [ ] **Step 2: Update `lib/import.ts` mapping + both import routes**

Read `src/lib/import.ts` and `src/app/api/import/{anilist,mal}/route.ts`. Wherever they build the old flat rows and call `upsertImported(userId, rows)`, change the row builder to produce `ImportRow` via `mapTitle(media)` for `meta` and split the user fields into `user`. Exact edit depends on their current shape — apply the mechanical rule: metadata fields → `mapTitle(media)`; `status/myScore/progress/watchedAt` → `user`. Preserve the existing `import.test.ts` expectations (adjust the test fixtures to the new return shape if they assert row structure).

- [ ] **Step 3: Run import tests**

Run: `npx vitest run src/lib/import.test.ts`
Expected: PASS after fixture adjustment.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: `import-upsert.ts` and both import routes clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import-upsert.ts src/lib/import.ts src/app/api/import/anilist/route.ts src/app/api/import/mal/route.ts src/lib/import.test.ts
git commit -m "feat(import): route importers through title catalog"
```

---

## Task 7: Migrate the three `anime` write routes

**Files:**
- Modify: `src/app/api/anime/route.ts`
- Modify: `src/app/api/anime/[id]/route.ts`
- Modify: `src/app/api/anime/restore/route.ts`

**Interfaces:**
- Consumes: `ensureTitle`, `ensureTitleByFields`, `addUserTitle`, `updateUserTitle`, `deleteUserTitle`, `joinedRow` from `@/lib/anime-write`; `mapTitle`/`TitleMetadata` from `@/lib/catalog`.
- Produces: identical JSON responses (`{ anime: <flat row> }`) as today — the client contract is unchanged because responses come from the `anime` view via `joinedRow`.

- [ ] **Step 1: Rewrite `POST` in `src/app/api/anime/route.ts`**

Keep `GET` unchanged (it selects `from(anime)` — now the view — and still works). Replace the `POST` body from the existing-check onward:

```typescript
  const existing = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.anilistId, anilistId)))
  if (existing.length) {
    if (body?.status && existing[0].status !== status) {
      const row = await updateUserTitle(userId, existing[0].id, {
        status, watchedAt: existing[0].watchedAt ?? userFields.watchedAt,
      })
      return NextResponse.json({ anime: row })
    }
    return NextResponse.json({ anime: existing[0] })
  }
  const media = await fetchMedia(anilistId, true)
  const titleId = await ensureTitle(media)
  const row = await addUserTitle(userId, titleId, userFields)
  try {
    const directors = await fetchDirectors(anilistId)
    if (directors.length) {
      await db.insert(animeStaff)
        .values(directors.map((d) => ({ userId, animeId: row.id, staffId: d.staffId, name: d.name, image: d.image, role: d.role })))
        .onConflictDoNothing()
    }
  } catch { /* staff nélkül is él a sor */ }
  return NextResponse.json({ anime: row }, { status: 201 })
```

Update the import line to drop `mapMedia`/`anime` insert usage and add the repo:

```typescript
import { anime, animeStaff, tasteMemory } from '@/db/schema'
import { fetchDirectors, fetchMedia } from '@/lib/anilist'
import { ensureTitle, addUserTitle, updateUserTitle } from '@/lib/anime-write'
```

- [ ] **Step 2: Rewrite the write branches in `src/app/api/anime/[id]/route.ts`**

`GET` unchanged (reads the view). In `PATCH`, replace the two `db.update(anime)…returning()` calls with `updateUserTitle`:

Rewatch branch:
```typescript
  if (body.rewatch === true) {
    const row = await updateUserTitle(userId, animeId, {
      rewatchCount: current.rewatchCount + 1, progress: 0, status: 'watching',
    })
    return NextResponse.json({ anime: row })
  }
```

Final update (keep the `episodeLog` insert exactly as-is — it references `animeId` which is now `user_title.id`, unchanged):
```typescript
  const row = await updateUserTitle(userId, animeId, patch)
  return NextResponse.json({ anime: row })
```

In `DELETE`, replace `await db.delete(anime).where(eq(anime.id, animeId))` with:
```typescript
  await deleteUserTitle(userId, animeId)
```

Update imports:
```typescript
import { anime, episodeLog, opinions, tasteMemory } from '@/db/schema'
import { updateUserTitle, deleteUserTitle } from '@/lib/anime-write'
```

> `ownedAnime()` stays as-is: it selects `from(anime)` (the view) filtered by `id`+`userId`, still correct.

- [ ] **Step 3: Rewrite `src/app/api/anime/restore/route.ts`**

The DELETE bundle contains a flat `anime` (view) row. Restore = ensure the title from the bundle's metadata, then re-add the user row + opinion + facts:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'
import { ensureTitleByFields, addUserTitle } from '@/lib/anime-write'
import type { TitleMetadata } from '@/lib/catalog'
import { titleSlug } from '@/lib/catalog'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const b = body?.bundle
  if (!b?.anime?.anilistId) {
    return NextResponse.json({ error: 'Hiányzó visszaállítási adat' }, { status: 400 })
  }
  const a = b.anime

  const existing = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.anilistId, a.anilistId)))
  if (existing.length) return NextResponse.json({ anime: existing[0] })

  const meta: TitleMetadata = {
    anilistId: a.anilistId, mediaType: a.mediaType ?? 'ANIME',
    slug: titleSlug(a.titleRomaji, a.anilistId),
    titleRomaji: a.titleRomaji, titleEnglish: a.titleEnglish ?? null,
    titleNative: a.titleNative ?? null, coverUrl: a.coverUrl ?? null,
    bannerUrl: a.bannerUrl ?? null, genres: a.genres ?? [], tags: a.tags ?? [],
    studio: a.studio ?? null, season: a.season ?? null, year: a.year ?? null,
    episodes: a.episodes ?? null, durationMin: a.durationMin ?? null,
    format: a.format ?? null, chapters: a.chapters ?? null, volumes: a.volumes ?? null,
    description: a.description ?? null, relations: a.relations ?? [],
    trailerSite: a.trailerSite ?? null, trailerId: a.trailerId ?? null,
    avgScore: a.avgScore ?? null,
  }
  const titleId = await ensureTitleByFields(meta)
  const row = await addUserTitle(userId, titleId, {
    status: a.status ?? 'planned',
    watchedAt: a.watchedAt ? new Date(a.watchedAt) : null,
  })
  // carry the user's score/progress/rewatch back onto the restored row
  const { updateUserTitle } = await import('@/lib/anime-write')
  const restored = await updateUserTitle(userId, row.id, {
    myScore: a.myScore ?? null, progress: a.progress ?? 0,
    rewatchCount: a.rewatchCount ?? 0,
  })

  if (b.opinion?.rawText) {
    await db.insert(opinions).values({
      animeId: row.id, rawText: b.opinion.rawText,
      extractStatus: b.opinion.extractStatus ?? 'done', updatedAt: new Date(),
    })
  }
  if (Array.isArray(b.facts) && b.facts.length) {
    await db.insert(tasteMemory).values(
      b.facts.map((f: { kind: string; text: string; source: string; weight?: number }) => ({
        userId, animeId: row.id, kind: f.kind, text: f.text,
        source: f.source ?? 'opinion', weight: f.weight ?? 1,
      })),
    )
  }
  return NextResponse.json({ anime: restored ?? row }, { status: 201 })
}
```

- [ ] **Step 4: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: 0 errors across the project (all `AnimeInsert` importers removed; read sites use the view).

- [ ] **Step 5: Run the full unit suite**

Run: `npx vitest run`
Expected: all pre-existing tests + the new `catalog`/`community-score` tests PASS.

- [ ] **Step 6: Manual smoke against the branch DB**

With `DATABASE_URL` on the migrated Neon branch, run `npm run dev` and verify in the app: add an anime (POST), bump progress (PATCH + heatmap logs a row), delete + undo (DELETE→restore), import a small AniList list. Confirm each returns the flat `anime` shape and the row appears on `/lista`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/anime/route.ts src/app/api/anime/[id]/route.ts src/app/api/anime/restore/route.ts
git commit -m "feat(anime): route writes through title catalog + user_title"
```

---

## Task 8: Catalog sync worker (populate `title` for the whole AniList catalog)

**Files:**
- Create: `src/lib/catalog-sync.ts` (pure paging/throttle helpers)
- Create: `src/lib/catalog-sync.test.ts`
- Create: `scripts/sync-catalog.mjs`

**Interfaces:**
- Produces:
  - `nextPageVars(page: number, perPage: number): { page: number; perPage: number }` — trivial, but keeps paging logic testable.
  - `sleepMsFor(remaining: number, resetInSec: number): number` — throttle: given AniList's `X-RateLimit-Remaining` and reset window, return ms to wait (0 if plenty of budget).
  - `scripts/sync-catalog.mjs` — pages AniList `Page(media)` sorted by `ID`, upserts each into `title`, throttled ≥ 700 ms, honoring 429. Supports `--since=<anilistId>` for incremental.

- [ ] **Step 1: Write failing tests for the throttle helper**

```typescript
// src/lib/catalog-sync.test.ts
import { describe, it, expect } from 'vitest'
import { nextPageVars, sleepMsFor } from './catalog-sync'

describe('nextPageVars', () => {
  it('passes page and perPage through', () => {
    expect(nextPageVars(3, 50)).toEqual({ page: 3, perPage: 50 })
  })
})

describe('sleepMsFor', () => {
  it('does not sleep when budget is healthy', () => {
    expect(sleepMsFor(60, 60)).toBe(0)
  })
  it('spreads remaining reset window when budget is low', () => {
    // 2 requests left, 30s to reset -> ~15000ms each
    expect(sleepMsFor(2, 30)).toBe(15000)
  })
  it('caps at the reset window when exhausted', () => {
    expect(sleepMsFor(0, 20)).toBe(20000)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/catalog-sync.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/catalog-sync.ts`**

```typescript
export function nextPageVars(page: number, perPage: number) {
  return { page, perPage }
}

// AniList caps at 90 req/min. Given the rate-limit headers, decide how long to
// wait before the next request so we never trip 429.
export function sleepMsFor(remaining: number, resetInSec: number): number {
  const resetMs = Math.max(0, resetInSec) * 1000
  if (remaining <= 0) return resetMs
  if (remaining > 10) return 0
  return Math.round(resetMs / remaining)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/catalog-sync.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write `scripts/sync-catalog.mjs`**

```javascript
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
    type: e.relationType, anilistId: e.node.id, title: e.node.title.romaji }))
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
```

- [ ] **Step 6: Dry-run a few pages against the branch DB**

Temporarily add an early `break` after `page >= 3` (or Ctrl-C after a few pages), run:
Run: `node scripts/sync-catalog.mjs --type=ANIME`
Expected: `page 1: +50 …` lines, `title` row count grows, no 429 crash. Remove the temp break after.

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalog-sync.ts src/lib/catalog-sync.test.ts scripts/sync-catalog.mjs
git commit -m "feat(sync): throttled AniList catalog sync into title"
```

---

## Task 9: Community-score recompute worker

**Files:**
- Create: `scripts/recompute-scores.mjs`

**Interfaces:**
- Consumes: `bayesianScore` logic (inlined in the script, matching `src/lib/community-score.ts`).
- Produces: updates `title.community_score`, `title.community_count`, `title.popularity` for every title.

- [ ] **Step 1: Write `scripts/recompute-scores.mjs`**

```javascript
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
```

- [ ] **Step 2: Run against branch DB and eyeball**

Run: `node scripts/recompute-scores.mjs`
Expected: `recomputed N titles, globalMean=…`; spot-check a popular title has `community_count > 0` and a `community_score` near the global mean.

- [ ] **Step 3: Commit**

```bash
git add scripts/recompute-scores.mjs
git commit -m "feat(scores): nightly community-score recompute worker"
```

---

## Task 10: Wire workers into cron + production cutover

**Files:**
- Modify: `.github/workflows/` (add a scheduled job invoking the two workers) — inspect the existing airing-check workflow and mirror its secret/`DATABASE_URL` setup.

- [ ] **Step 1: Add a nightly GitHub Actions job**

Create `.github/workflows/catalog.yml` mirroring the existing cron workflow's `DATABASE_URL` secret usage:

```yaml
name: catalog
on:
  schedule:
    - cron: '0 3 * * *'   # 03:00 UTC nightly
  workflow_dispatch: {}
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: node scripts/sync-catalog.mjs --type=ANIME
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
      - run: node scripts/recompute-scores.mjs
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
```

- [ ] **Step 2: Production cutover (run once, in order)**

This is the irreversible step — take a Neon backup/branch first.

1. Deploy the branch with Tasks 1–9 merged (code tolerates both old and new shapes only after migration, so app stays in maintenance for the migration window).
2. Point at prod `DATABASE_URL`, run `node scripts/migrate-catalog-split.mjs`.
3. Run `node scripts/verify-catalog-split.mjs` → must print `integrity OK`.
4. Run `node scripts/recompute-scores.mjs` for the initial scores.
5. Smoke the live app (add/patch/delete/import) exactly as Task 7 Step 6.
6. Kick a full `node scripts/sync-catalog.mjs` (hours) to backfill the whole catalog for M2's public pages.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/catalog.yml
git commit -m "chore(cron): nightly catalog sync + score recompute"
```

---

## Self-Review

**Spec coverage (M1 goals):**
- Global catalog table → Task 3 (`title`) + Task 8 (full sync). ✅
- Per-user list decoupled from metadata → Task 3 (`user_title`) + Task 4 (migration, id-preserving). ✅
- FK safety for the six dependent tables → Task 4 renames in place, id preserved; verified Task 4 Step 2. ✅
- Read sites unaffected → Task 3 `anime` view; typecheck gate Task 3 Step 4 + Task 7 Step 4. ✅
- Write sites migrated → Tasks 5–7 (6 sites: anime POST, [id] PATCH/DELETE, restore, import-upsert, importers). ✅
- Community scores → Task 2 helper + Task 9 worker. ✅
- Public-catalog data readiness for M2 → Task 8 sync + Task 10 cron. ✅

**Placeholder scan:** One deliberate "apply the mechanical rule" remains in Task 6 Step 2 (importer mapping) because `lib/import.ts` was not read at plan time — the step names the exact files and the exact transform (`mapTitle(media)` for meta, split user fields), and gates on `import.test.ts`. Acceptable: the executor reads the file first. No other placeholders.

**Type consistency:** `AnimeRow`/`AnimeSelect` = the `anime` view row throughout; `TitleMetadata` (Task 1) is the exact insert shape consumed by `ensureTitleByFields` (Task 5) and produced by importers (Task 6) and restore (Task 7); `titleId: number` returned by `ensureTitle*` and consumed by `addUserTitle`. `sleepMsFor` signature identical in test (Task 8 Step 1), lib (Step 3), and script (Step 5). Column names match `schema.ts` verbatim.

**Known risk:** Drizzle `pgView(...).existing()` must expose column names exactly matching the DB view created in Task 4; any drift surfaces immediately in Task 7's typecheck + smoke. Mitigated by dry-run on a Neon branch before prod cutover (Task 4 Step 3, Task 10 Step 2).
