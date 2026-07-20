# M2b — Canonical Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one public, SEO-cacheable canonical page per title at `/anime/[slug]` and `/manga/[slug]` that renders public metadata from the `title` catalog to everyone and owner controls (status/progress/score/opinion/delete) only when logged in and the title is on the user's list — subsuming today's owner-only `/anime/[id]` page, which becomes a 301 redirect.

**Architecture:** A shared server component `CatalogTitlePage` resolves a slug → `title` row (cached, ISR), renders the public sections, and mounts a **client** `OwnerOverlay` in a separate dynamic boundary. The overlay fetches the caller's owned row via a new `GET /api/anime/owned?titleId=` (returns null when anonymous or not owned) and renders either the owner controls (extracted from the current `/anime/[id]` page) or an "add to list" CTA. The cached shell is viewer-independent; only the client overlay is personalized, so the public page stays cacheable for SEO. Legacy numeric `/anime/[id]` and the AniList preview page redirect to the canonical slug.

**Tech Stack:** Next.js 15.5 (App Router, ISR — no Next 16 Cache Components), Drizzle ORM, Neon Postgres, vitest (pure units only).

## Global Constraints

- **Next.js 15.5** — ISR via `export const revalidate` + `generateStaticParams` + `export const dynamicParams = true`. No `use cache`.
- **Cached shell must be viewer-independent:** never read the session or owner data in the cached server component. Owner data is fetched ONLY inside the client `OwnerOverlay`. Putting session/owner reads in the cached page is a correctness bug (one user's data leaks to all viewers).
- **DB writes:** only via `src/lib/anime-write.ts`; reads of the catalog via `title`/the `anime` view. Never a direct `neon()` in app code.
- **No top-level `db`** in route/page modules that could be statically collected.
- **UI language:** Hungarian (i18n is M3).
- **Slug scheme:** `titleSlug(romaji, anilistId)` = `slugify(romaji)-anilistId`, unique per `(media_type, slug)` (from M1/M2a). Canonical paths: `/anime/[slug]` for `mediaType==='ANIME'`, `/manga/[slug]` for `'MANGA'`.
- **Response/behavior parity:** every owner action that works on `/anime/[id]` today (status, progress, myScore, rewatch, opinion→facts, delete-with-undo, finish modal, add-to-shared-watchlist, character favorite) must keep working in the overlay, using the same API routes.

---

## File Structure

**New files:**
- `src/lib/catalog-page.ts` — `resolveTitleBySlug`, `canonicalPath`, `legacyRedirectTarget`. Pure `canonicalPath` unit-tested.
- `src/lib/catalog-page.test.ts` — `canonicalPath` tests.
- `src/app/api/anime/owned/route.ts` — `GET ?titleId=` → owner row + opinion + facts, or `{ owned: null }`.
- `src/components/OwnerOverlay.tsx` — client component: owner controls + opinion editor + facts + finish modal + delete + watchlist add, OR "add to list" CTA. Extracted from `/anime/[id]/page.tsx`.
- `src/components/CatalogTitlePage.tsx` — shared server component: public sections + `<OwnerOverlay>` + `<CharacterGrid>` + themes.
- `src/app/anime/[slug]/page.tsx` — thin wrapper: `CatalogTitlePage mediaType="ANIME"`.
- `src/app/manga/[slug]/page.tsx` — thin wrapper: `CatalogTitlePage mediaType="MANGA"`.

**Modified files:**
- `src/app/anime/[id]/page.tsx` — replace the client owner page with a server component that 301-redirects a numeric id to its canonical slug.
- `src/app/anime/preview/[anilistId]/page.tsx` — redirect to the canonical slug (public page now handles not-owned too); keep as a thin anilistId→slug resolver or delete if unused after link updates.
- `src/app/bongeszo/page.tsx` — `hrefFor` links to canonical `/anime|manga/[slug]`.
- `src/components/AddAnimeSearch.tsx` — after adding, navigate to canonical slug (if it still navigates).

---

## Task 1: slug resolution helpers (`catalog-page.ts`)

**Files:**
- Create: `src/lib/catalog-page.ts`
- Test: `src/lib/catalog-page.test.ts`

**Interfaces:**
- Produces:
  - `canonicalPath(mediaType: string, slug: string): string` → `/manga/${slug}` if `mediaType==='MANGA'`, else `/anime/${slug}`.
  - `type TitleRow = typeof title.$inferSelect`
  - `resolveTitleBySlug(mediaType: 'ANIME' | 'MANGA', slug: string): Promise<TitleRow | null>` — one indexed lookup on `(media_type, slug)`.
  - `legacyRedirectTarget(userTitleId: number): Promise<string | null>` — join `user_title`→`title`, return `canonicalPath(t.mediaType, t.slug)` or null.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/catalog-page.test.ts
import { describe, it, expect } from 'vitest'
import { canonicalPath } from './catalog-page'

describe('canonicalPath', () => {
  it('routes anime under /anime', () => {
    expect(canonicalPath('ANIME', 'steins-gate-9253')).toBe('/anime/steins-gate-9253')
  })
  it('routes manga under /manga', () => {
    expect(canonicalPath('MANGA', 'berserk-30002')).toBe('/manga/berserk-30002')
  })
  it('treats unknown mediaType as anime', () => {
    expect(canonicalPath('WHATEVER', 'x-1')).toBe('/anime/x-1')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/catalog-page.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/lib/catalog-page.ts`**

```typescript
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { title, userTitle } from '@/db/schema'

export type TitleRow = typeof title.$inferSelect

export function canonicalPath(mediaType: string, slug: string): string {
  return `/${mediaType === 'MANGA' ? 'manga' : 'anime'}/${slug}`
}

export async function resolveTitleBySlug(
  mediaType: 'ANIME' | 'MANGA', slug: string,
): Promise<TitleRow | null> {
  const [row] = await db.select().from(title)
    .where(and(eq(title.mediaType, mediaType), eq(title.slug, slug)))
  return row ?? null
}

export async function legacyRedirectTarget(userTitleId: number): Promise<string | null> {
  const [row] = await db.select({ mediaType: title.mediaType, slug: title.slug })
    .from(userTitle).innerJoin(title, eq(userTitle.titleId, title.id))
    .where(eq(userTitle.id, userTitleId))
  return row ? canonicalPath(row.mediaType, row.slug) : null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/catalog-page.test.ts` (Expected: PASS, 3 tests)
Run: `npx tsc --noEmit` (Expected: 0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog-page.ts src/lib/catalog-page.test.ts
git commit -m "feat(catalog): slug resolution + canonical-path helpers"
```

---

## Task 2: owner-data-by-titleId API

**Files:**
- Create: `src/app/api/anime/owned/route.ts`

**Interfaces:**
- Consumes: `requireUserId`, `db`, `anime` view, `opinions`, `tasteMemory`.
- Produces: `GET /api/anime/owned?titleId=<n>` →
  - anonymous or not owned: `{ owned: null }` (HTTP 200, never 401/404 — the public page must render for everyone).
  - owned: `{ owned: { anime: <flat row>, opinion, facts } }` — same shape the client overlay needs, mirroring `/api/anime/[id]` GET.

- [ ] **Step 1: Write `src/app/api/anime/owned/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  const titleId = Number(new URL(req.url).searchParams.get('titleId'))
  if (!userId || !Number.isInteger(titleId) || titleId <= 0) {
    return NextResponse.json({ owned: null })
  }
  const [row] = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.titleId, titleId)))
  if (!row) return NextResponse.json({ owned: null })
  const [opinion] = await db.select().from(opinions).where(eq(opinions.animeId, row.id))
  const facts = await db.select({
    id: tasteMemory.id, animeId: tasteMemory.animeId, kind: tasteMemory.kind, text: tasteMemory.text,
  }).from(tasteMemory).where(eq(tasteMemory.animeId, row.id))
  return NextResponse.json({ owned: { anime: row, opinion: opinion ?? null, facts } })
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Manual (dev server, logged in): `curl` with the session cookie to `/api/anime/owned?titleId=<an owned title id>` returns `{ owned: { anime, opinion, facts } }`; an un-owned titleId returns `{ owned: null }`; logged out returns `{ owned: null }`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/anime/owned/route.ts
git commit -m "feat(catalog): GET /api/anime/owned?titleId returns owner overlay data"
```

---

## Task 3: extract `OwnerOverlay` client component

**Files:**
- Create: `src/components/OwnerOverlay.tsx`
- Reference (read, do not yet delete): `src/app/anime/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/anime/owned?titleId=`, and the existing mutation routes (`PATCH`/`DELETE /api/anime/[id]`, `POST /api/opinion`, `DELETE /api/taste/[id]`, `POST /api/watchlist`). `ApiAnime` type from `@/lib/types`.
- Produces: `<OwnerOverlay titleId={number} anilistId={number} watchlistMeta={{title, coverUrl, mediaType}} />` — a client component that:
  - on mount fetches `/api/anime/owned?titleId=`;
  - if `owned` → renders the owner controls block (status `<select>`, progress input, myScore input, rewatch button, "+ Közösbe", opinion editor + facts, delete-with-undo, finish modal) exactly as the current `/anime/[id]` page does, keyed by `owned.anime.id`;
  - if `owned === null` → renders the add-to-list CTA (Láttam/Nézem/Tervezem) that `POST /api/anime` with `{ titleId, status }`, then re-fetches owned (no navigation — the overlay updates in place).

- [ ] **Step 1: Read the current owner page**

Read `src/app/anime/[id]/page.tsx` fully. Identify the owner-only JSX blocks and their handlers: the controls bar (status/progress/myScore/rewatch/watchlist), the opinion editor + facts list + finish modal, and the delete button. These move verbatim into `OwnerOverlay`, with two changes: (a) data comes from `/api/anime/owned?titleId=` instead of `/api/anime/[id]`, and (b) all mutation calls keep using `/api/anime/${owned.anime.id}` etc. (the numeric user_title id from the fetched owned row).

- [ ] **Step 2: Write `OwnerOverlay.tsx`**

Create the client component. Skeleton (fill the owner-control JSX by moving it from the current page — keep every handler and API call identical, just source `id` from `owned.anime.id`):

```typescript
'use client'
import { useCallback, useEffect, useState } from 'react'
import type { ApiAnime } from '@/lib/types'

type Fact = { id: number; animeId: number; kind: string; text: string }
type Owned = { anime: ApiAnime; opinion: { rawText: string; extractStatus: string } | null; facts: Fact[] }

const ADD_OPTIONS = [
  { status: 'completed', label: 'Láttam' },
  { status: 'watching', label: 'Nézem' },
  { status: 'planned', label: 'Tervezem' },
] as const

export default function OwnerOverlay({
  titleId, anilistId, watchlistMeta,
}: {
  titleId: number
  anilistId: number
  watchlistMeta: { title: string; coverUrl: string | null; mediaType: string }
}) {
  const [owned, setOwned] = useState<Owned | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/anime/owned?titleId=${titleId}`)
    const j = await res.json() as { owned: Owned | null }
    setOwned(j.owned)
    setLoaded(true)
  }, [titleId])

  useEffect(() => { load() }, [load])

  async function addToList(status: string) {
    const res = await fetch('/api/anime', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleId, status }),
    })
    if (res.ok) await load()
  }

  if (!loaded) return null // avoid a flash; overlay is progressive enhancement
  if (!owned) {
    return (
      <div className="glass rounded-3xl p-4 flex flex-wrap items-center gap-2">
        <span className="label-mono">Nincs a listádon</span>
        {ADD_OPTIONS.map((o) => (
          <button key={o.status} onClick={() => addToList(o.status)}
            className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors">
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  // OWNED: move the controls bar + opinion editor + facts + finish modal + delete
  // from src/app/anime/[id]/page.tsx here verbatim. Use `owned.anime.id` as the
  // mutation id, `owned.anime` for current values, `owned.opinion`/`owned.facts`,
  // and call `load()` after each mutation to refresh. `watchlistMeta` feeds the
  // "+ Közösbe" POST /api/watchlist body.
  const a = owned.anime
  return (
    <OwnerControls owned={owned} reload={load} watchlistMeta={watchlistMeta} />
  )
}
```

Then implement `OwnerControls` (same file or split) by transplanting the exact JSX + handlers from the current `/anime/[id]` page's controls bar, opinion section, finish modal, and delete button, substituting `a.id` for the route param id and `reload()` for the page's `load()`. Do not change the API calls or their bodies.

- [ ] **Step 3: Verify build + tsc**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Run: `npx vitest run` (Expected: full suite passes)

- [ ] **Step 4: Commit**

```bash
git add src/components/OwnerOverlay.tsx
git commit -m "feat(catalog): OwnerOverlay client component (owner controls + add CTA)"
```

---

## Task 4: canonical page + wrappers

**Files:**
- Create: `src/components/CatalogTitlePage.tsx`
- Create: `src/app/anime/[slug]/page.tsx`
- Create: `src/app/manga/[slug]/page.tsx`
- Reference: `src/app/anime/preview/[anilistId]/page.tsx` (public-section markup to reuse), `src/app/anime/[id]/page.tsx` (public sections: hero, description, themes, relations, CharacterGrid).

**Interfaces:**
- Consumes: `resolveTitleBySlug`, `canonicalPath` (Task 1); `OwnerOverlay` (Task 3); existing `CharacterGrid`; themes via the existing `/api/themes/[anilistId]` (client) or a themes client block.
- Produces: `CatalogTitlePage({ mediaType, slug }: { mediaType: 'ANIME' | 'MANGA'; slug: string })` — async server component. `notFound()` when slug unresolved. Renders public sections from the `title` row + `<OwnerOverlay titleId anilistId watchlistMeta />`.

- [ ] **Step 1: Write `CatalogTitlePage.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { resolveTitleBySlug } from '@/lib/catalog-page'
import OwnerOverlay from '@/components/OwnerOverlay'
import CharacterGrid from '@/components/CharacterGrid'

export default async function CatalogTitlePage({
  mediaType, slug,
}: { mediaType: 'ANIME' | 'MANGA'; slug: string }) {
  const t = await resolveTitleBySlug(mediaType, slug)
  if (!t) notFound()
  // PUBLIC sections from the title row (reuse the preview page's markup for hero,
  // metadata chips, genres, description, trailer/themes, relations). Then:
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-6">
      {/* hero: cover/banner, titles, chips (year/format/episodes|chapters/studio),
          community_score + avg_score, genre pills — all from `t` */}
      {/* OwnerOverlay: personalized, dynamic (not part of the cached shell) */}
      <OwnerOverlay
        titleId={t.id}
        anilistId={t.anilistId}
        watchlistMeta={{ title: t.titleRomaji, coverUrl: t.coverUrl, mediaType: t.mediaType }}
      />
      {/* description (strip HTML), CharacterGrid (anilistId + t.id as animeId-analog?),
          themes player by t.anilistId, relations from t.relations */}
      <CharacterGrid anilistId={t.anilistId} animeId={t.id} />
    </main>
  )
}
```

Fill the public-section JSX by adapting the preview page's markup (hero/metadata/description/trailer) plus the owner page's relations + themes blocks, sourcing every field from `t` (the `title` row). Add a community-score chip (`t.communityScore`) next to the AniList average.

> `CharacterGrid`'s favorite-toggle POST requires an owned `animeId`; passing `t.id` (a `title` id, not a `user_title` id) would break the favorite write for owned users. Decision: pass the character grid `anilistId` for display, and gate the favorite ♥ behind ownership inside the overlay flow — for M2b, render `CharacterGrid` in read-only mode (display only) on the public page; a follow-up wires favorites through the overlay. Note this scope cut in the commit.

- [ ] **Step 2: Write the two route wrappers with ISR**

`src/app/anime/[slug]/page.tsx`:
```typescript
import CatalogTitlePage from '@/components/CatalogTitlePage'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { and, desc, eq } from 'drizzle-orm'

export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  const rows = await db.select({ slug: title.slug }).from(title)
    .where(eq(title.mediaType, 'ANIME')).orderBy(desc(title.popularity)).limit(500)
  return rows.map((r) => ({ slug: r.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CatalogTitlePage mediaType="ANIME" slug={slug} />
}
```

`src/app/manga/[slug]/page.tsx`: identical but `mediaType: 'MANGA'` in both the `generateStaticParams` filter and the component prop.

> `and` is imported but unused in this snippet — drop it if your linter flags it; keep only what the query uses.

- [ ] **Step 3: Verify build + manual smoke**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Run: `npm run build` (Expected: success; `/anime/[slug]` and `/manga/[slug]` appear as ISR/dynamic routes, `generateStaticParams` runs without DB error)
Manual: `npm run dev`, open `/anime/<a real slug from the catalog, e.g. steins-gate-9253>` logged OUT → public sections render, "Nincs a listádon" + add buttons; log IN and open an owned title's slug → owner controls appear with current status/score; mutate → persists.

- [ ] **Step 4: Commit**

```bash
git add src/components/CatalogTitlePage.tsx "src/app/anime/[slug]/page.tsx" "src/app/manga/[slug]/page.tsx"
git commit -m "feat(catalog): canonical /anime|manga/[slug] public pages with ISR + owner overlay"
```

---

## Task 5: legacy redirects + canonical links

**Files:**
- Modify: `src/app/anime/[id]/page.tsx`
- Modify: `src/app/anime/preview/[anilistId]/page.tsx`
- Modify: `src/app/bongeszo/page.tsx`

**Interfaces:**
- Consumes: `legacyRedirectTarget`, `canonicalPath`, `resolveTitleBySlug` (Task 1).

- [ ] **Step 1: Convert `/anime/[id]` to a redirect**

Replace the entire client `src/app/anime/[id]/page.tsx` with a server component that 301-redirects a numeric user_title id to its canonical slug:

```typescript
import { redirect, notFound } from 'next/navigation'
import { legacyRedirectTarget } from '@/lib/catalog-page'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) notFound()
  const target = await legacyRedirectTarget(n)
  if (!target) notFound()
  redirect(target)
}
```

> This preserves every existing `/anime/<numeric>` link (from the graph, lists, feed, old bookmarks) by bouncing to the canonical page, where the owner overlay restores the same controls.

- [ ] **Step 2: Point the preview page at the canonical slug**

In `src/app/anime/preview/[anilistId]/page.tsx`, replace the AniList-fetch-and-render body: resolve the title from the catalog by anilistId and redirect to its canonical slug (the public page now covers not-owned rendering). If the title is not in the catalog yet, keep the existing AniList preview render as a fallback. Concretely: query `title` by `anilistId` (either media type); if found, `redirect(canonicalPath(row.mediaType, row.slug))`; else fall back to the current AniList preview. Remove the owned→`/anime/[id]` redirect (the canonical page handles owned via the overlay).

- [ ] **Step 3: Canonical links in browse**

In `src/app/bongeszo/page.tsx`, change `hrefFor(h)` to always return the canonical slug: `` `/${h.mediaType === 'MANGA' ? 'manga' : 'anime'}/${h.slug}` `` (drop the owned-vs-preview branching — the canonical page serves both). `TitleHit` already carries `mediaType` and `slug`.

- [ ] **Step 4: Verify build + full smoke**

Run: `npx tsc --noEmit` (Expected: 0 errors)
Run: `npx vitest run` (Expected: full suite passes)
Run: `npm run build` (Expected: success)
Manual: open a `/anime/<numeric-id>` URL → 301s to the canonical slug; browse → click a result → lands on the canonical page; preview URL for a catalogued title → 301s to slug.

- [ ] **Step 5: Commit**

```bash
git add "src/app/anime/[id]/page.tsx" "src/app/anime/preview/[anilistId]/page.tsx" src/app/bongeszo/page.tsx
git commit -m "feat(catalog): legacy /anime/[id] + preview redirect to canonical slug; browse links canonical"
```

---

## Self-Review

**Spec coverage (M2b portion of the M2 spec):**
- Unified `/anime/[slug]` + `/manga/[slug]` public pages → Task 4. ✅
- Public data from `title` catalog by slug → Task 1 (`resolveTitleBySlug`) + Task 4. ✅
- Owner overlay only when logged in + owned; add CTA otherwise → Task 2 (`/api/anime/owned`) + Task 3 (`OwnerOverlay`). ✅
- Cached shell viewer-independent, owner data in a dynamic client boundary → Task 4 (ISR server shell) + Task 3 (client overlay fetch). ✅
- Legacy `/anime/[id]` → 301; preview → canonical; browse links canonical → Task 5. ✅
- Reviews section → deferred to M4 (not built), correctly out of scope.
- Owner-feature parity (status/progress/score/opinion/delete/finish/watchlist) → Task 3 moves them verbatim. Character favorite is scoped to read-only on the public page (Task 4 note) — a deliberate, logged scope cut, not a silent gap.

**Placeholder scan:** Task 3 (OwnerOverlay) and Task 4 (public sections) rely on "move the JSX verbatim from the current page" transforms because the owner page is large and fully inventoried but not transcribed here — each names the exact source file, the exact blocks to move, the exact data source swap (`/api/anime/owned` vs `/api/anime/[id]`; `owned.anime.id` as the mutation id), and gates on tsc + build + a logged-in/out manual smoke. The `CharacterGrid` favorite scope cut is called out explicitly. No `TBD`/`add validation` placeholders.

**Type consistency:** `canonicalPath(mediaType, slug)` signature is identical across Tasks 1, 4, 5. `resolveTitleBySlug(mediaType, slug)` returns `TitleRow` used by Task 4. `/api/anime/owned` returns `{ owned: { anime, opinion, facts } | null }`, consumed by `OwnerOverlay` with the matching `Owned` type. `OwnerOverlay` props (`titleId`, `anilistId`, `watchlistMeta`) match its mount in `CatalogTitlePage`. Mutation ids use `owned.anime.id` (the user_title id via the compat view) — consistent with the existing `/api/anime/[id]` routes.

**Known risks:**
- **ISR + owner leak:** the single most important correctness point — the cached server shell must not read the session. Enforced by architecture (owner data only in the client overlay) and called out in Global Constraints; verify in the Task 4 smoke by loading a slug logged-out and confirming no owner controls are server-rendered.
- **`generateStaticParams` at build:** runs a DB query at build time; needs `DATABASE_URL` available to the build. If the build env lacks it, either guard `generateStaticParams` to return `[]` when the query throws, or ensure the env is present. Flagged in Task 4 Step 3.
