# M2 — Public Catalog + SEO — Design Spec

**Date:** 2026-07-20
**Milestone:** M2 (follows M1 catalog-split, merged to master @ `ac4f171`)
**Status:** approved in brainstorming, pending spec review → writing-plans

## Goal

Give every title (anime **and** manga) a public, SEO-indexable, fast canonical page, and replace remote search with our own catalog search. This is the user-acquisition wedge: search-engine traffic to canonical pages brings visitors before the community layer (M4) exists. The AI/3D features stay the differentiator; M2 makes the catalog discoverable.

## Context (what M1 delivered)

- `title` global catalog table (metadata + `slug`, `community_score`, `community_count`, `popularity`, `synced_at`), unique on `(anilist_id, media_type)` and `(media_type, slug)`.
- `user_title` per-user list; `anime` compat **view** (`user_title ⋈ title`) for legacy reads.
- `lib/anime-write.ts` write-repo; `lib/catalog.ts` (`mapTitle`, `titleSlug`, `slugify`).
- `scripts/sync-catalog.mjs` (throttled AniList → title, page-paginated, 5xx-retry) + `recompute-scores.mjs` + nightly `catalog.yml` cron.
- Dev DB migrated; full ANIME sync running.

## Scope

**In scope (M2):**
- Unified canonical page `/anime/[slug]` and `/manga/[slug]`, public by default, owner-controls when logged in.
- 301 redirect from legacy `/anime/[id]` (numeric) to the canonical slug URL.
- Own Postgres full-text search (tsvector) over `title`, used by both the public browse/search and the add-flow. AniList proxy demoted to fallback for not-yet-synced titles.
- SEO: per-page JSON-LD, canonical tags, OpenGraph; `sitemap.xml` (sitemap index + chunked child sitemaps) and `robots.txt`; on-demand cached rendering (no 20k-page build).
- Full **MANGA** catalog sync in addition to anime.
- `title` gets a generated `search_vector` tsvector column + GIN index (migration).

**Out of scope (deferred):**
- User reviews and review voting → **M4**. The canonical page reserves a review section slot but ships without it.
- Follow/feed, forums → M4.
- Per-user / group watchlist rework → M3.
- i18n (EN-first) → M3. M2 pages stay Hungarian UI like the rest of the app; only user-generated title metadata is English/native/romaji.

## Architecture Overview

```
Request /anime/steins-gate-9253
  -> resolve slug: SELECT * FROM title WHERE media_type='ANIME' AND slug=$1
  -> 404 if none
  -> render PUBLIC sections from `title` (cached, on-demand ISR)
  -> if session present: SELECT user_title WHERE user_id=? AND title_id=?
       -> render OWNER sections (status/progress/score, opinion, facts) or "add to list" CTA
```

The page never assumes ownership. Public data always comes from `title`; owner data is an optional overlay keyed by `(user_id, title_id)`.

## Components & Units

### 1. Slug resolution (`lib/catalog-page.ts`)
- `resolveTitleBySlug(mediaType: 'ANIME'|'MANGA', slug: string): Promise<Title | null>` — single indexed lookup on `(media_type, slug)`.
- `canonicalPath(t: { mediaType: string; slug: string }): string` → `/anime/${slug}` or `/manga/${slug}`.
- `legacyRedirectTarget(userTitleId: number): Promise<string | null>` — join user_title→title, return `canonicalPath`. Used by the `/anime/[id]` numeric route.
- Pure/thin-DB units, unit-tested where pure (`canonicalPath`), integration-thin otherwise.

### 2. The canonical page (`app/anime/[slug]/page.tsx`, `app/manga/[slug]/page.tsx`)
Both are thin wrappers over a shared `CatalogTitlePage` server component parametrized by `mediaType`. Sections:
- **Public (always):** hero (cover/banner), titles (romaji/english/native), metadata (studio, year, episodes/chapters+volumes, format, genres, tags), community score + count + popularity, AniList average, description (HTML-stripped), related titles (links to canonical pages), characters (lazy client fetch from existing `/api/characters/[anilistId]`), OP/ED themes (existing `/api/themes/[anilistId]`), streaming links (existing `/api/links/[anilistId]`), "Add to my list" CTA.
- **Owner overlay (session + owned):** status/progress/score/rewatch controls, opinion editor → AI facts, add-to-shared-watchlist — migrated from the current `app/anime/[id]/page.tsx`.
- **Owner overlay (session, not owned):** "Add to list" with status choices (writes via `anime-write.addUserTitle`).
- Reviews: a commented placeholder slot; no implementation (M4).

The existing rich owner-detail logic (`app/anime/[id]/page.tsx` + its client components) is refactored into owner-overlay components consumed by the shared page. The numeric `/anime/[id]` route becomes a redirect-only handler.

### 3. Search (`lib/search.ts`, `app/api/search/route.ts`, browse UI)
- Migration adds `title.search_vector tsvector` (generated column from `title_romaji || english || native`) + GIN index.
- `searchTitles(q: string, opts: { mediaType?; limit; offset }): Promise<TitleHit[]>` — `websearch_to_tsquery` ranked by `ts_rank_cd(search_vector, query)` blended with `popularity` (rank first, popularity as tiebreak).
- Public browse page `/bongeszo` reworked to call this instead of the AniList proxy; add-flow (`AddAnimeSearch`) calls this and adds by `titleId` (via `ensureUserTitle`), falling back to AniList proxy + `ensureTitle` only when the catalog has zero hits (title not yet synced).
- Pure ranking-blend helper unit-tested; the SQL query integration-thin.

### 4. SEO (`app/sitemap.ts` or `app/sitemap/[chunk]`, `app/robots.ts`, per-page metadata)
- `robots.ts` allows all, points at the sitemap index.
- Sitemap: a sitemap **index** plus chunked child sitemaps (≤ 45k URLs each — under Google's 50k cap) generated from `title` (slug + synced_at as lastmod), covering both media types. Chunking helper unit-tested.
- Per-page `generateMetadata`: title, description (truncated synopsis), canonical URL, OpenGraph (cover image), and JSON-LD (`schema.org` `TVSeries`/`Movie` for anime by format, `Book`/`CreativeWork` for manga) injected as a `<script type="application/ld+json">`.

### 5. Rendering strategy
- Project is **Next.js 15.5** (App Router) — use **ISR**, not Next 16 Cache Components. The public shell is a cached Server Component: `export const revalidate = 86400` (daily) + `generateStaticParams` returning only the **top-N by popularity** (e.g. 500) for build-time prerender + `export const dynamicParams = true` so all other slugs render on first request and are then cached. No full 20k+ build.
- Owner-overlay data must NOT be baked into the cached shell: fetch it in a separate dynamic boundary (a client component that calls an owner-data API, or a `dynamic`-marked segment), so the cached public page is identical for all viewers and only the overlay is per-request. This keeps the SEO page cacheable while owner controls stay personalized.
- Cache invalidation: the nightly `recompute-scores` / sync updates `title`; the daily `revalidate` TTL refreshes scores — exact scores are not latency-critical.

### 6. Manga sync
- Run `sync-catalog.mjs --type=MANGA` (150k+ rows, hours) to populate manga titles. Same idempotent upsert. Nightly `catalog.yml` extended to sync MANGA too (or a separate scheduled run to spread load).

## Data Model Changes

Migration `scripts/migrate-search-vector.mjs` (idempotent):
- `ALTER TABLE title ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title_romaji,'') || ' ' || coalesce(title_english,'') || ' ' || coalesce(title_native,''))) STORED;`
- `CREATE INDEX IF NOT EXISTS title_search_gin ON title USING GIN (search_vector);`
- Drizzle schema `title` gains the `searchVector` column (typed, `.generatedAlwaysAs(...)`) + the GIN index declaration so introspection stays consistent.

Note: `'simple'` config (not language-specific stemming) because titles are proper nouns across languages; stemming would hurt. Reconsider per-language config later if needed.

## Testing Strategy

- Pure units (vitest): `canonicalPath`, search rank-blend helper, sitemap chunking, JSON-LD builder (given a title → correct schema.org object).
- Integration-thin: `resolveTitleBySlug`, `searchTitles`, `legacyRedirectTarget` — exercised against the migrated dev DB in a smoke script (not in CI, matching the repo's pure-only vitest convention).
- `next build` must stay green (all routes compile).
- Manual smoke: load `/anime/<known-slug>` logged-out (public sections + JSON-LD present, no owner controls) and logged-in (owner overlay appears); search returns ranked hits; `/anime/<numeric-id>` 301s to slug; `sitemap.xml` returns the index.

## Risks / Open Questions

- **Owner-page refactor size:** merging the current rich `/anime/[id]` into the shared canonical page is the bulk of the work; risk of regressing existing owner features (opinion→facts, characters, themes). Mitigation: migrate section-by-section with the owner-overlay components tested against the migrated DB.
- **Cover hotlinking at scale:** public pages at SEO scale hotlink AniList/s4.anilist.co covers through the existing `/_next/image` proxy. Fine for M2; a cover CDN is M6.
- **tsvector language:** `'simple'` chosen; may under-serve fuzzy/typo search. Trigram (`pg_trgm`) similarity is a later enhancement, not M2.
- **Full manga sync load:** 150k rows × ~700ms ≈ many hours; run once out-of-band, then incremental via cron.
