# M2a — Catalog Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remote AniList search with our own Postgres full-text (tsvector) search over the `title` catalog, used by both the public browse UI and the add-to-list flow, with the AniList proxy demoted to a fallback for titles not yet synced.

**Architecture:** Add a generated `search_vector` tsvector column + GIN index to `title` (migration). A `searchTitles()` repo function runs `websearch_to_tsquery` ranked by `ts_rank_cd` blended with `popularity`. A new `/api/search` route exposes it. The browse page and the add-anime search box call `/api/search`; the add-flow adds by `titleId` (no AniList round-trip when the title is already in the catalog), falling back to the existing AniList-proxy add only on zero catalog hits.

**Tech Stack:** Next.js 15.5 (App Router), Drizzle ORM, Neon serverless Postgres, vitest (pure-logic units only), plain `.mjs` migration scripts.

## Global Constraints

- **Next.js version:** 15.5 — App Router, no Next 16 features (no `use cache`).
- **DB access:** always through `@/db/client` (`db`); never a direct `neon()` call in app code. Migrations are `.mjs` scripts using `neon()` directly and reading `process.env.DATABASE_URL`.
- **No top-level `db`:** never reference `db` at module top level in route files (build-time page collection).
- **AniList rate limit:** 90 req/min; any AniList call keeps the existing throttling. Catalog search must NOT call AniList.
- **UI language:** Hungarian (i18n is M3).
- **tsvector config:** `'simple'` (no stemming) — titles are cross-language proper nouns.
- **Idempotent migration:** the migration script must be safe to re-run (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- **Slug/route base:** canonical paths are `/anime/[slug]` and `/manga/[slug]` (built in M2b). Search results carry `mediaType` + `slug` so M2b can link them; M2a does not build the pages.

---

## File Structure

**New files:**
- `scripts/migrate-search-vector.mjs` — adds `title.search_vector` generated column + GIN index. Idempotent.
- `src/lib/search.ts` — `rankBlend()` pure helper + `searchTitles()` repo function.
- `src/lib/search.test.ts` — unit tests for `rankBlend`.
- `src/app/api/search/route.ts` — `GET /api/search?q=&type=&limit=&offset=`.

**Modified files:**
- `src/db/schema.ts` — add `searchVector` column + GIN index to the `title` table object.
- `src/app/bongeszo/page.tsx` — rework to call `/api/search` instead of the AniList browse proxy.
- `src/components/AddAnimeSearch.tsx` — search via `/api/search`; add by `titleId`.
- `src/app/api/anime/route.ts` — `POST` accepts `titleId` (catalog add, no AniList fetch) in addition to the existing `anilistId` path.

---

## Task 1: search_vector migration + schema

**Files:**
- Create: `scripts/migrate-search-vector.mjs`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces: `title.search_vector` (tsvector, generated from romaji+english+native) + `title_search_gin` GIN index in the DB; Drizzle `title` object gains a matching `searchVector` column + index declaration.

- [ ] **Step 1: Write `scripts/migrate-search-vector.mjs`**

```javascript
// Adds the full-text search vector + GIN index to title. Idempotent.
// Run: node scripts/migrate-search-vector.mjs
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })

async function main() {
  console.log('1/2 add generated search_vector column')
  await sql`
    ALTER TABLE title ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(title_romaji, '') || ' ' ||
        coalesce(title_english, '') || ' ' ||
        coalesce(title_native, ''))
    ) STORED`
  console.log('2/2 create GIN index')
  await sql`CREATE INDEX IF NOT EXISTS title_search_gin ON title USING GIN (search_vector)`
  console.log('done.')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run the migration against the dev DB**

Run (from repo root, with the dev DB URL loaded):
`DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^\"//; s/\"$//')" node scripts/migrate-search-vector.mjs`
Expected: prints `1/2 …`, `2/2 …`, `done.` No error. Re-running prints the same (idempotent).

- [ ] **Step 3: Add the column + index to `src/db/schema.ts`**

In the `title` pgTable definition, add the column after `syncedAt` (before `createdAt`):

```typescript
  syncedAt: timestamp('synced_at'),
  searchVector: tsvector('search_vector').generatedAlwaysAs(
    sql`to_tsvector('simple', coalesce(title_romaji,'') || ' ' || coalesce(title_english,'') || ' ' || coalesce(title_native,''))`,
  ),
  createdAt: timestamp('created_at').notNull().defaultNow(),
```

Drizzle has no built-in `tsvector` type helper, so define one at the top of `schema.ts` (after the imports) using `customType`:

```typescript
import { customType } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const tsvector = customType<{ data: string }>({
  dataType() { return 'tsvector' },
})
```

Add the GIN index to the `title` table's index array:

```typescript
}, (t) => [
  uniqueIndex('title_anilist_type_unique').on(t.anilistId, t.mediaType),
  uniqueIndex('title_slug_unique').on(t.mediaType, t.slug),
  index('title_search_gin').using('gin', t.searchVector),
])
```

Add `index` to the `drizzle-orm/pg-core` import.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (The `searchVector` column is read-only in practice; no code writes it.)

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-search-vector.mjs src/db/schema.ts
git commit -m "feat(search): title search_vector generated column + GIN index"
```

---

## Task 2: rank-blend pure helper

**Files:**
- Create: `src/lib/search.ts` (helper only in this task)
- Test: `src/lib/search.test.ts`

**Interfaces:**
- Produces: `rankBlend(textRank: number, popularity: number): number` — combines the text relevance (`ts_rank_cd`, typically 0..~1) with popularity so that, among similar text matches, more-popular titles rank higher, but a strong text match still beats a weak one on a popular title. Formula: `textRank + Math.log10(popularity + 1) * 0.05`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/search.test.ts
import { describe, it, expect } from 'vitest'
import { rankBlend } from './search'

describe('rankBlend', () => {
  it('adds a small popularity boost to the text rank', () => {
    // popularity 9999 -> log10(10000)=4 -> +0.2
    expect(rankBlend(0.5, 9999)).toBeCloseTo(0.7, 5)
  })
  it('is monotonic in popularity for equal text rank', () => {
    expect(rankBlend(0.5, 1000)).toBeGreaterThan(rankBlend(0.5, 10))
  })
  it('a strong text match beats a weak match on a popular title', () => {
    // strong text 0.9 unpopular vs weak text 0.4 very popular
    expect(rankBlend(0.9, 0)).toBeGreaterThan(rankBlend(0.4, 100000))
  })
  it('handles zero popularity without NaN', () => {
    expect(rankBlend(0.3, 0)).toBeCloseTo(0.3, 5)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/search.test.ts`
Expected: FAIL — module not found / `rankBlend` not exported.

- [ ] **Step 3: Write the helper in `src/lib/search.ts`**

```typescript
// Blend text relevance with popularity: among similar text matches the more
// popular title wins, but a strong text match still beats a weak one on a
// popular title. Log-damped so blockbusters don't drown out exact matches.
export function rankBlend(textRank: number, popularity: number): number {
  return textRank + Math.log10(Math.max(0, popularity) + 1) * 0.05
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/search.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat(search): rank-blend helper (text relevance + popularity)"
```

---

## Task 3: searchTitles + /api/search route

**Files:**
- Modify: `src/lib/search.ts` (add `searchTitles`)
- Create: `src/app/api/search/route.ts`

**Interfaces:**
- Consumes: `db`, `title` from `@/db/schema`, `rankBlend` (though the blend is done in SQL here — see note).
- Produces:
  - `TitleHit = { titleId: number; anilistId: number; mediaType: string; slug: string; titleRomaji: string; titleEnglish: string | null; coverUrl: string | null; year: number | null; format: string | null; communityScore: number | null; popularity: number }`
  - `searchTitles(q: string, opts?: { mediaType?: 'ANIME' | 'MANGA'; limit?: number; offset?: number }): Promise<TitleHit[]>` — empty array for a blank query.
  - `GET /api/search?q=&type=&limit=&offset=` → `{ hits: TitleHit[] }`.

> Note: the blend runs in SQL (`ts_rank_cd(...) + log(...)`) so the DB can order + limit before returning rows. `rankBlend` (Task 2) documents/tests the same formula for parity and is used if any client-side re-ranking is ever needed.

- [ ] **Step 1: Add `searchTitles` to `src/lib/search.ts`**

```typescript
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

export type TitleHit = {
  titleId: number
  anilistId: number
  mediaType: string
  slug: string
  titleRomaji: string
  titleEnglish: string | null
  coverUrl: string | null
  year: number | null
  format: string | null
  communityScore: number | null
  popularity: number
}

export async function searchTitles(
  q: string,
  opts: { mediaType?: 'ANIME' | 'MANGA'; limit?: number; offset?: number } = {},
): Promise<TitleHit[]> {
  const query = q.trim()
  if (!query) return []
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20))
  const offset = Math.max(0, opts.offset ?? 0)
  const typeFilter = opts.mediaType
    ? sql`AND media_type = ${opts.mediaType}`
    : sql``
  const rows = await db.execute(sql`
    SELECT id AS "titleId", anilist_id AS "anilistId", media_type AS "mediaType",
      slug, title_romaji AS "titleRomaji", title_english AS "titleEnglish",
      cover_url AS "coverUrl", year, format,
      community_score AS "communityScore", popularity
    FROM title,
      websearch_to_tsquery('simple', ${query}) AS q
    WHERE search_vector @@ q ${typeFilter}
    ORDER BY ts_rank_cd(search_vector, q) + log(popularity + 1) * 0.05 DESC,
      popularity DESC
    LIMIT ${limit} OFFSET ${offset}`)
  return rows.rows as unknown as TitleHit[]
}
```

> `db.execute` returns `{ rows }` for the neon-http driver. If the local Drizzle version returns the array directly, use `return rows as unknown as TitleHit[]` — verify by logging the shape once during Step 3.

- [ ] **Step 2: Write `src/app/api/search/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { searchTitles } from '@/lib/search'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const typeParam = searchParams.get('type')
  const mediaType = typeParam === 'MANGA' ? 'MANGA' : typeParam === 'ANIME' ? 'ANIME' : undefined
  const limit = Number(searchParams.get('limit')) || 20
  const offset = Number(searchParams.get('offset')) || 0
  const hits = await searchTitles(q, { mediaType, limit, offset })
  return NextResponse.json({ hits })
}
```

- [ ] **Step 3: Manual smoke against the dev DB**

Start the dev server (`npm run dev`) and:
`curl "http://localhost:3000/api/search?q=steins&type=ANIME"`
Expected: JSON `{ "hits": [ … ] }` with Steins;Gate near the top, each hit carrying `titleId`, `mediaType`, `slug`, `coverUrl`. If the shape is wrong, adjust the `rows` unwrap per the Step 1 note. A blank `q` returns `{ "hits": [] }`.

- [ ] **Step 4: Typecheck + unit tests**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Run: `npx vitest run src/lib/search.test.ts` (Expected: PASS — `rankBlend` unchanged)

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/app/api/search/route.ts
git commit -m "feat(search): searchTitles over catalog + /api/search route"
```

---

## Task 4: rework the browse page to use catalog search

**Files:**
- Modify: `src/app/bongeszo/page.tsx`

**Interfaces:**
- Consumes: `GET /api/search?q=&type=&limit=&offset=` → `{ hits: TitleHit[] }`.

> Context: `bongeszo/page.tsx` currently calls the AniList browse proxy (`/api/browse`) with search + genre/format/year/minScore filters and a random pick. This task repoints the text-search path to `/api/search` (own catalog). Genre/format/year filters that the catalog search does not yet support are out of scope for M2a — keep them only if they map to columns already returned; otherwise remove the unsupported filter controls in this task and note it. The random pick can stay on the AniList proxy or be dropped; dropping is fine (YAGNI) — note whichever you choose.

- [ ] **Step 1: Read the current file and identify the fetch + result-render**

Read `src/app/bongeszo/page.tsx`. Locate where it fetches `/api/browse` (or `/api/anilist/search`) and where it maps results into cards.

- [ ] **Step 2: Repoint the search fetch to `/api/search`**

Replace the browse/search fetch with:
```typescript
const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${mediaType ? `&type=${mediaType}` : ''}`)
const { hits } = await res.json() as { hits: import('@/lib/search').TitleHit[] }
```
Map `hits` into the existing result cards using `hit.titleRomaji`, `hit.coverUrl`, `hit.year`, `hit.format`, `hit.communityScore`. Each card links to `/${hit.mediaType === 'MANGA' ? 'manga' : 'anime'}/${hit.slug}` (the M2b canonical pages; until M2b ships the link 404s — acceptable, note it) and its add-button passes `hit.titleId` (see Task 5).

- [ ] **Step 3: Remove unsupported filter controls**

Delete the genre/format/year/minScore filter UI and their state if they targeted the AniList proxy and are not backed by `/api/search`. Keep an optional ANIME/MANGA toggle mapped to the `type` param. Note in the commit what was removed.

- [ ] **Step 4: Verify build + manual smoke**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Manual: `npm run dev`, open `/bongeszo`, type "steins" → catalog hits render; ANIME/MANGA toggle filters.

- [ ] **Step 5: Commit**

```bash
git add src/app/bongeszo/page.tsx
git commit -m "feat(search): browse page uses catalog /api/search"
```

---

## Task 5: add-flow adds by titleId (AniList fallback only)

**Files:**
- Modify: `src/components/AddAnimeSearch.tsx`
- Modify: `src/app/api/anime/route.ts`

**Interfaces:**
- Consumes: `GET /api/search`, `addUserTitle`/`ensureTitle` from `@/lib/anime-write`.
- Produces: `POST /api/anime` accepts `{ titleId, status? }` (catalog add, no AniList fetch) OR the existing `{ anilistId, status? }` (fallback). Response shape unchanged: `{ anime: <flat row> }`.

- [ ] **Step 1: Extend `POST /api/anime` to accept `titleId`**

Read `src/app/api/anime/route.ts`. In `POST`, before the existing anilistId handling, add a `titleId` branch:

```typescript
  const titleId = Number(body?.titleId)
  if (Number.isInteger(titleId) && titleId > 0) {
    // catalog add: title already exists, no AniList round-trip
    const status = ADD_STATUSES.includes(body?.status) ? body.status as string : 'planned'
    const existing = await db.select().from(userTitle)
      .where(and(eq(userTitle.userId, userId), eq(userTitle.titleId, titleId)))
    if (existing.length) {
      const row = await joinedRow(existing[0].id)
      return NextResponse.json({ anime: row })
    }
    const row = await addUserTitle(userId, titleId, {
      status, watchedAt: status === 'completed' ? new Date() : null,
    })
    return NextResponse.json({ anime: row }, { status: 201 })
  }
```

Add the needed imports: `userTitle` from `@/db/schema`, `addUserTitle`, `joinedRow` from `@/lib/anime-write` (some may already be imported). Keep the existing `anilistId` path unchanged as the fallback.

- [ ] **Step 2: Point the add-search box at `/api/search`**

Read `src/components/AddAnimeSearch.tsx`. Replace its AniList search fetch with `/api/search` and render `TitleHit` results. Each result's add button POSTs `{ titleId: hit.titleId, status }` to `/api/anime` (instead of `{ anilistId }`). If the catalog search returns zero hits for the query, show a "nincs a katalógusban" state with an optional AniList-fallback add that still POSTs `{ anilistId }` (existing path) — keep this fallback minimal.

- [ ] **Step 3: Typecheck + unit tests**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Run: `npx vitest run` (Expected: full suite passes — no regressions)

- [ ] **Step 4: Manual smoke**

`npm run dev`, log in, open the add-search (Lista or Gráf), type a title → catalog hits → click add → appears in the list; adding an already-owned title is idempotent (returns the existing row, no duplicate).

- [ ] **Step 5: Commit**

```bash
git add src/components/AddAnimeSearch.tsx src/app/api/anime/route.ts
git commit -m "feat(search): add-flow adds by catalog titleId, AniList fallback"
```

---

## Self-Review

**Spec coverage (M2a portion of the M2 spec):**
- Own tsvector search over `title` → Task 1 (column/index) + Task 3 (`searchTitles`). ✅
- Search used by public browse → Task 4. ✅
- Search used by add-flow, add by `titleId`, AniList fallback → Task 5. ✅
- `'simple'` tsvector config → Task 1 migration + schema. ✅
- Ranking blends relevance + popularity → Task 2 (helper) + Task 3 (SQL). ✅
- Canonical page rendering / SEO → NOT here (M2b/M2c), correctly out of scope.

**Placeholder scan:** Tasks 4 and 5 include "read the current file, apply transform" steps because `bongeszo/page.tsx` and `AddAnimeSearch.tsx` were not read at plan time — each names the exact file, the exact fetch to swap, and the exact result fields to map, and gates on tsc + a manual smoke. The genre-filter removal (Task 4 Step 3) is an explicit scoped decision, not a vague deferral. No `TBD`/`add validation`/`handle edge cases` placeholders.

**Type consistency:** `TitleHit` fields are identical across Task 3 (definition), Task 4 (browse consumption), Task 5 (add consumption). `searchTitles(q, opts)` signature matches its `/api/search` caller. `addUserTitle(userId, titleId, {status, watchedAt})` and `joinedRow(id)` match their M1 definitions in `anime-write.ts`. The SQL blend formula in Task 3 (`log(popularity+1)*0.05`) matches `rankBlend` in Task 2.

**Known risk:** `db.execute` row-shape (`{ rows }` vs array) depends on the installed Drizzle/neon-http version — Task 3 Step 1 flags it and Step 3 verifies it during smoke. This is the one spot to watch during execution.
