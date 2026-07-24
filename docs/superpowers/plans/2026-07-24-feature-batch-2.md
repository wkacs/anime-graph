# Feature-batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 2026-07-24-i spec 13 tétele: gráf-zoom + TasteCard bugfix, böngésző üres-állapot, klub-UX, publikus rendezés, export-törlés, vélemény-váró oldal, toplista, next-season, címoldal-bővítés, vibe-bővítés, kitűzés, wrapped-story.

**Architecture:** Minden új logika tiszta lib-függvény (`src/lib/*.ts`) vitest-tel, a route-ok/oldalak vékonyak maradnak. Lokális `title`-katalógusból dolgozunk (külső hívás csak a stáb-querynél, `api_cache`-en át). Meglévő minták: drizzle query-builder helperek (`browse-local` stílus), client oldalak `fetch`-csel, glass-UI Tailwind-osztályok.

**Tech Stack:** Next.js App Router, Drizzle + Neon, vitest, Tailwind; NINCS új dependency.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-feature-batch-2-design.md` — döntések onnan kötelezők.
- Új dependency tilos (wrapped-animáció CSS-ből).
- Publikus felületre vélemény/ízlés-adat NEM mehet ki (`public-view.ts` whitelist a kapu).
- Minden task végén: `npx tsc --noEmit` + `npm run test` zöld, aztán commit.
- Commit-üzenetek magyarul, ékezet nélkül, a repo eddigi stílusában (`feat(...)`/`fix(...)`).
- UI-szövegek magyarul.

---

### Task 1: Gráf — zoom a kurzorhoz

**Files:**
- Modify: `src/components/Graph3D.tsx` (a `controls()`-t már használó effect, ~270. sor környéke)

**Interfaces:** nincs új export.

- [ ] **Step 1: three-verzió ellenőrzés.** `npm ls three` — ha ≥ 0.149 (r149), az OrbitControls natívan tudja a `zoomToCursor`-t.
- [ ] **Step 2: Implementáció.** Abban az effectben, ahol először elérhető a `fg.controls()` (az init-effect, ahol a kamera-dive fut), add hozzá:

```tsx
const controls = fg.controls() as { zoomToCursor?: boolean }
if (controls) controls.zoomToCursor = true
```

Ha a Step 1 szerint a three < r149: wheel-fallback helyett frissítés NEM kell — a react-force-graph-3d friss three-t húz; ebben az esetben állj meg és jelezz.
- [ ] **Step 3: Vizuális ellenőrzés.** `npm run dev` → /graf → görgetés a gráf szélére mutató kurzorral: a zoom a kurzor iránya felé menjen, ne a közép felé. Drill-down és első-betöltés `zoomToFit` változatlanul működjön.
- [ ] **Step 4: Commit.** `git commit -m "fix(graf): zoom a kurzor fele (OrbitControls zoomToCursor)"`

### Task 2: TasteCard layout-fix

**Files:**
- Modify: `src/components/TasteCard.tsx`
- Kontextus: `src/app/stats/page.tsx:251` a hívó.

- [ ] **Step 1: Reprodukció.** Dev-serveren /stats → ízlés-DNS kártya: elcsúszás + a képek a statokra lógnak. Olvasd el a teljes `TasteCard.tsx`-et, azonosítsd az ütközést (várható: absolute-pozicionált képsáv fix magasság nélkül, vagy grid-oszlop `min-w-0` hiány / hiányzó `overflow-hidden`).
- [ ] **Step 2: Fix.** A diagnózis szerint: absolute elem kap méretezett wrappert (`relative` + fix `h-*`), a szöveg-oszlopok `min-w-0`-t, a kártya `overflow-hidden`-t. Cél: a képek saját sávban, statok alá nem lóghatnak, 360px-es mobilnézetben sem.
- [ ] **Step 3: Vizuális ellenőrzés** desktop + mobil szélességen.
- [ ] **Step 4: Commit.** `git commit -m "fix(stats): TasteCard elcsuszas es kep-atfedes javitas"`

### Task 3: Böngésző üres állapota — „Felkapott most"

**Files:**
- Create: `src/lib/trending.ts`, `src/lib/trending.test.ts`
- Create: `src/app/api/trending/route.ts`
- Modify: `src/app/bongeszo/page.tsx`

**Interfaces:**
- Produces: `trendingSeasonParams(now: Date): { season: string; year: number }`; `TRENDING_LIMIT = 12`; API `GET /api/trending` → `{ seasonal: TitleRow[]; popular: TitleRow[] }` (TitleRow = a `title` tábla sora, ahogy a `/api/browse` adja).

- [ ] **Step 1: Failing test** (`src/lib/trending.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { trendingSeasonParams, TRENDING_LIMIT } from './trending'

describe('trendingSeasonParams', () => {
  it('aktualis szezont adja', () => {
    expect(trendingSeasonParams(new Date('2026-07-24T12:00:00Z'))).toEqual({ season: 'SUMMER', year: 2026 })
  })
  it('limit 12', () => { expect(TRENDING_LIMIT).toBe(12) })
})
```

- [ ] **Step 2: Futtatás** `npx vitest run src/lib/trending.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implementáció** (`src/lib/trending.ts`):

```ts
import { currentSeason } from './seasonal'

// A bongeszo ures allapota: az aktualis szezon legjobbjai + nalunk nepszeru cimek.
export const TRENDING_LIMIT = 12

export function trendingSeasonParams(now: Date): { season: string; year: number } {
  return currentSeason(now)
}
```

- [ ] **Step 4: Route** (`src/app/api/trending/route.ts`) — session-köteles (mint a `/api/browse`), két lokális query:

```ts
import { NextResponse } from 'next/server'
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { trendingSeasonParams, TRENDING_LIMIT } from '@/lib/trending'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const s = trendingSeasonParams(new Date())
  const [seasonal, popular] = await Promise.all([
    db.select().from(title)
      .where(and(eq(title.mediaType, 'ANIME'), eq(title.season, s.season), eq(title.year, s.year), isNotNull(title.avgScore)))
      .orderBy(desc(title.avgScore)).limit(TRENDING_LIMIT),
    db.select().from(title)
      .where(gte(title.popularity, 1))
      .orderBy(desc(title.popularity)).limit(TRENDING_LIMIT),
  ])
  return NextResponse.json({ seasonal, popular })
}
```

- [ ] **Step 5: UI.** `bongeszo/page.tsx`: amikor nincs aktív keresés/szűrő ÉS még nincs találat-lista betöltve, `/api/trending`-et kér, és két rácsot mutat („Felkapott most — {szezon}" és „Nálunk népszerű") a meglévő találat-kártya komponenssel. Ha van query/szűrő → a mostani viselkedés.
- [ ] **Step 6: Teszt+tsc, vizuális ellenőrzés, commit.** `git commit -m "feat(bongeszo): felkapott-most ures allapot lokalis katalogusbol"`

### Task 4: Klub-ajánló UX

**Files:**
- Modify: `src/app/vs/page.tsx`

**Interfaces:** a `/api/group-pick` válasza már tartalmazza `perMember: (number|null)[]`-t — csak megjelenítés.

- [ ] **Step 1: „Hogyan működik?" collapsible** a pick-lista fölé (`<details>` + glass-stílus):

```tsx
<details className="glass rounded-2xl px-4 py-3 text-sm text-text-2">
  <summary className="cursor-pointer text-text-1">Hogyan működik a klub-ajánló?</summary>
  <p className="mt-2">Minden tagra kiszámoljuk, mennyire illik a cím az ízléséhez (0–100).
  A csoport-pontszám 60% átlag + 40% minimum — a legalacsonyabb érték védi a leggyengébb
  láncszemet. Ha valakinél 35 alá esne, a cím kiesik (vétó). Legalább 2 tagnál kell
  ismert ízlés-adat.</p>
</details>
```

- [ ] **Step 2: Tagonkénti sávok** minden pick-kártya alá: tag-név + vízszintes sáv (`w-[{fit}%]`), `null` → „nincs adat"; fit < 45 → sáv borostyán/piros árnyalat (`bg-amber-400/70`), egyébként a meglévő accent. A tag-nevek a lap már ismert résztvevő-listájából jönnek (a perMember sorrendje a kiválasztott tagok sorrendje).
- [ ] **Step 3: Vizuális ellenőrzés + commit.** `git commit -m "feat(vs): mukodes-magyarazat es tagonkenti fit-savok"`

### Task 5: Publikus lista rendezés (`/p/[token]`)

**Files:**
- Modify: `src/lib/public-view.ts`, `src/lib/public-view.test.ts`, `src/app/p/[token]/page.tsx`

**Interfaces:**
- Produces: `sortPublicList(list: PublicAnime[], sort: PublicSort): PublicAnime[]`, `type PublicSort = 'score' | 'title' | 'year'`.

- [ ] **Step 1: Failing test** (a meglévő `public-view.test.ts`-be):

```ts
import { sortPublicList, type PublicAnime } from './public-view'

const mk = (t: string, s: number | null, y: number | null): PublicAnime =>
  ({ title: t, coverUrl: null, status: 'completed', myScore: s, year: y })

describe('sortPublicList', () => {
  const list = [mk('B', 7, 2020), mk('A', null, 2024), mk('C', 9, null)]
  it('pont szerint csokkeno, null a vegen', () => {
    expect(sortPublicList(list, 'score').map((a) => a.title)).toEqual(['C', 'B', 'A'])
  })
  it('cim A-Z', () => {
    expect(sortPublicList(list, 'title').map((a) => a.title)).toEqual(['A', 'B', 'C'])
  })
  it('ev csokkeno, null a vegen', () => {
    expect(sortPublicList(list, 'year').map((a) => a.title)).toEqual(['A', 'B', 'C'])
  })
  it('nem mutalja az inputot', () => {
    const before = [...list]; sortPublicList(list, 'score'); expect(list).toEqual(before)
  })
})
```

- [ ] **Step 2: FAIL-ellenőrzés**, majd implementáció (`public-view.ts` végére):

```ts
export type PublicSort = 'score' | 'title' | 'year'

export function sortPublicList(list: PublicAnime[], sort: PublicSort): PublicAnime[] {
  const copy = [...list]
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title, 'hu'))
  const key = sort === 'score' ? (a: PublicAnime) => a.myScore : (a: PublicAnime) => a.year
  return copy.sort((a, b) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity))
}
```

- [ ] **Step 3: UI.** `p/[token]/page.tsx`: state `sort: PublicSort` (default `'score'`) + `statusFilter: string | null`; a rács fölé chipsor: rendezés (Pont ↓ / Cím A–Z / Év ↓) + státusz-chipek (Mind + a `STATUS_LABELS` kulcsai). Megjelenítés: `sortPublicList(data.anime.filter(...), sort)`.
- [ ] **Step 4: Teszt + commit.** `git commit -m "feat(publikus): rendezes es statusz-szuro a megoszthato listan"`

### Task 6: Adatmentés (export) törlése

**Files:**
- Delete: `src/app/api/export/route.ts` (+ ha van hozzá lib/teszt: azt is)
- Modify: `src/app/beallitasok/page.tsx` (~230–237. sor, „Adatmentés" szekció)

- [ ] **Step 1:** `grep -rn "api/export" src/` — minden hivatkozás összegyűjtése.
- [ ] **Step 2:** Szekció + route (+ esetleges lib/teszt) törlése; ha a publikus/privát route-lista (whitelist-audit teszt) említi, onnan is ki.
- [ ] **Step 3:** `tsc` + teljes teszt + commit. `git commit -m "chore(beallitasok): adatmentes-export eltavolitasa"`

### Task 7: Vélemény-váró oldal — `/velemenyek`

**Files:**
- Create: `src/lib/opinion-queue.ts`, `src/lib/opinion-queue.test.ts`
- Create: `src/app/api/opinions/pending/route.ts`
- Create: `src/app/velemenyek/page.tsx`
- Modify: `src/components/TopNav.tsx`

**Interfaces:**
- Produces: `opinionQueue(rows: OpinionQueueInput[]): OpinionQueueInput[]` és
  `type OpinionQueueInput = { id: number; titleRomaji: string; coverUrl: string | null; status: string; myScore: number | null; createdAt: string; hasOpinion: boolean; extractStatus: string | null }`.
- API: `GET /api/opinions/pending` → `{ items: OpinionQueueInput[]; count: number }`; `?countOnly=1` → `{ count }`.
- A vélemény-mentés a MEGLÉVŐ `/api/opinion` végpontra megy (animeId + text) — nézd meg a pontos payloadot implementáció előtt.

- [ ] **Step 1: Failing test** (`src/lib/opinion-queue.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { opinionQueue, type OpinionQueueInput } from './opinion-queue'

const mk = (o: Partial<OpinionQueueInput>): OpinionQueueInput => ({
  id: 1, titleRomaji: 'X', coverUrl: null, status: 'completed', myScore: null,
  createdAt: '2026-01-01T00:00:00Z', hasOpinion: false, extractStatus: null, ...o,
})

describe('opinionQueue', () => {
  it('kiszuri akinek mar van velemenye', () => {
    expect(opinionQueue([mk({ hasOpinion: true })])).toEqual([])
  })
  it('failed extract visszakerul a sorba', () => {
    expect(opinionQueue([mk({ hasOpinion: true, extractStatus: 'failed' })])).toHaveLength(1)
  })
  it('planned nem jelenik meg', () => {
    expect(opinionQueue([mk({ status: 'planned' })])).toEqual([])
  })
  it('completed elol, aztan watching, aztan dropped; belul myScore desc', () => {
    const rows = [
      mk({ id: 1, status: 'watching' }),
      mk({ id: 2, status: 'completed', myScore: 7 }),
      mk({ id: 3, status: 'dropped' }),
      mk({ id: 4, status: 'completed', myScore: 9 }),
    ]
    expect(opinionQueue(rows).map((r) => r.id)).toEqual([4, 2, 1, 3])
  })
})
```

- [ ] **Step 2: FAIL**, majd implementáció (`src/lib/opinion-queue.ts`):

```ts
// Velemeny-varo sor: sajat cimek, amikhez nincs (sikeres) velemeny.
export type OpinionQueueInput = {
  id: number; titleRomaji: string; coverUrl: string | null; status: string
  myScore: number | null; createdAt: string; hasOpinion: boolean; extractStatus: string | null
}

const STATUS_ORDER: Record<string, number> = { completed: 0, watching: 1, dropped: 2 }

export function opinionQueue(rows: OpinionQueueInput[]): OpinionQueueInput[] {
  return rows
    .filter((r) => r.status in STATUS_ORDER)
    .filter((r) => !r.hasOpinion || r.extractStatus === 'failed')
    .sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || (b.myScore ?? -1) - (a.myScore ?? -1)
      || b.createdAt.localeCompare(a.createdAt))
}
```

- [ ] **Step 3: Route.** `anime` view LEFT JOIN `opinions` (animeId), a user saját sorai; `countOnly=1` esetén csak darabszám. Session-köteles.
- [ ] **Step 4: Oldal.** Kártya-rács: borító + cím + státusz-pötty + pont; kártyán textarea + „Mentés" gomb → POST `/api/opinion`; sikernél a kártya optimistán kikerül. Üres állapot: „Minden címedről van vélemény 🎉".
- [ ] **Step 5: TopNav.** Új tab `{ href: '/velemenyek', label: 'Vélemények' }` a Lista után + badge: mountkor `fetch('/api/opinions/pending?countOnly=1')`, ha `count > 0`, kis szám-badge a label mellett (`rounded-full bg-white/15 px-1.5 text-[10px]`).
- [ ] **Step 6: Teszt + vizuális + commit.** `git commit -m "feat(velemenyek): velemeny-varo oldal inline szerkesztessel + TopNav-badge"`

### Task 8: Toplista — `/toplista`

**Files:**
- Create: `src/lib/leaderboard.ts`, `src/lib/leaderboard.test.ts`
- Create: `src/app/api/leaderboard/route.ts`
- Create: `src/app/toplista/page.tsx`
- Modify: `src/components/TopNav.tsx` (új tab)
- Modify: a publikus route-whitelist (audit-teszt), mert a `/api/leaderboard` session NÉLKÜL megy.

**Interfaces:**
- Produces: `leaderboardQuery(tab: LeaderboardTab, mediaType: 'ANIME'|'MANGA', genre?: string): { where: SQL; order: SQL }`, `type LeaderboardTab = 'sajat' | 'anilist' | 'nepszeru'`, `COMMUNITY_MIN_COUNT = 2`, `LEADERBOARD_LIMIT = 50`; parse-helper `parseLeaderboardTab(raw: string | null): LeaderboardTab` (ismeretlen → `'anilist'`).
- API: `GET /api/leaderboard?tab=&type=&genre=` → `{ items: { rank, id, slug, mediaType, titleRomaji, coverUrl, avgScore, communityScore, communityCount, popularity, genres }[] }`.

- [ ] **Step 1: Failing test** (`src/lib/leaderboard.test.ts`) — a `browse-local` teszt-stílusát követve (SQL-objektum helyett a parse/threshold logikát teszteljük):

```ts
import { describe, expect, it } from 'vitest'
import { parseLeaderboardTab, COMMUNITY_MIN_COUNT, LEADERBOARD_LIMIT } from './leaderboard'

describe('parseLeaderboardTab', () => {
  it('ismert fulek', () => {
    expect(parseLeaderboardTab('sajat')).toBe('sajat')
    expect(parseLeaderboardTab('nepszeru')).toBe('nepszeru')
  })
  it('ismeretlen/null -> anilist', () => {
    expect(parseLeaderboardTab('x')).toBe('anilist')
    expect(parseLeaderboardTab(null)).toBe('anilist')
  })
})
it('kuszobok', () => {
  expect(COMMUNITY_MIN_COUNT).toBe(2)
  expect(LEADERBOARD_LIMIT).toBe(50)
})
```

- [ ] **Step 2: FAIL**, majd implementáció (`src/lib/leaderboard.ts`):

```ts
import { and, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm'
import { title } from '@/db/schema'

export type LeaderboardTab = 'sajat' | 'anilist' | 'nepszeru'
export const COMMUNITY_MIN_COUNT = 2
export const LEADERBOARD_LIMIT = 50

export function parseLeaderboardTab(raw: string | null): LeaderboardTab {
  return raw === 'sajat' || raw === 'nepszeru' ? raw : 'anilist'
}

export function leaderboardQuery(tab: LeaderboardTab, mediaType: 'ANIME' | 'MANGA', genre?: string): { where: SQL; order: SQL } {
  const parts: SQL[] = [eq(title.mediaType, mediaType)]
  if (genre) parts.push(sql`${genre} = ANY(${title.genres})`)
  if (tab === 'sajat') {
    parts.push(gte(title.communityCount, COMMUNITY_MIN_COUNT))
    return { where: and(...parts)!, order: desc(title.communityScore) }
  }
  if (tab === 'nepszeru') {
    parts.push(gte(title.popularity, 1))
    return { where: and(...parts)!, order: desc(title.popularity) }
  }
  parts.push(isNotNull(title.avgScore))
  return { where: and(...parts)!, order: desc(title.avgScore) }
}
```

- [ ] **Step 3: Route.** Session-mentes (publikus), `s-maxage=3600` cache-headerrel; a query a fenti helperrel, limit `LEADERBOARD_LIMIT`, rank = index+1.
- [ ] **Step 4: Oldal.** Client page: fülek (Nálunk / AniList / Legnézettebb), anime/manga váltó, műfaj-chipsor (fix lista a meglévő böngésző-műfajokból); sor: `#rank`, borító (link `/anime|manga/[slug]`), cím, jobb szélen a fül szerinti metrika (★ communityScore · n / AniList % / n felvevő).
- [ ] **Step 5: TopNav** — `{ href: '/toplista', label: 'Toplista' }` a Böngésző után.
- [ ] **Step 6: Whitelist-audit teszt frissítés** (a publikus route-lista bővül `/api/leaderboard`-dal), teljes teszt, vizuális, commit. `git commit -m "feat(toplista): harom fules leaderboard mufaj-szurovel"`

### Task 9: Böngésző-szűrők bővítése — stúdió + szezon (közös alap a 10–11-hez)

**Files:**
- Modify: `src/lib/browse.ts` (`BrowseFilters` bővítés), `src/lib/browse-local.ts`, `src/lib/browse-local.test.ts`, `src/app/api/browse/route.ts`, `src/app/bongeszo/page.tsx`

**Interfaces:**
- `BrowseFilters` bővül: `studio?: string; seasonKey?: 'current' | 'next'`.
- Produces: `resolveSeason(key: 'current' | 'next' | undefined, now: Date): { season: string; year: number } | null` a `browse-local.ts`-ben.
- A route querystringje: `&studio=MAPPA`, `&season=next|current`.

- [ ] **Step 1: Failing test** (`browse-local.test.ts`-be):

```ts
import { resolveSeason } from './browse-local'

describe('resolveSeason', () => {
  it('current', () => {
    expect(resolveSeason('current', new Date('2026-07-24'))).toEqual({ season: 'SUMMER', year: 2026 })
  })
  it('next atfordul evvalton', () => {
    expect(resolveSeason('next', new Date('2026-11-05'))).toEqual({ season: 'WINTER', year: 2027 })
  })
  it('undefined -> null', () => {
    expect(resolveSeason(undefined, new Date())).toBeNull()
  })
})
```

- [ ] **Step 2: FAIL**, majd implementáció: `resolveSeason` a `seasonal.ts` `currentSeason`/`nextSeason` helpereire épül; `browseWhere` két új ága:

```ts
if (f.studio) parts.push(eq(title.studio, f.studio))
// a route a seasonKey-t mar felbontott {season, year} parkent adja at:
if (f.season) parts.push(eq(title.season, f.season))
if (f.seasonYear) parts.push(eq(title.year, f.seasonYear))
```

(`BrowseFilters`-be ehhez: `studio?: string; season?: string; seasonYear?: number` — a `seasonKey` felbontását a route végzi `resolveSeason`-nal.)
- [ ] **Step 3: Route parse** (`parseFilters`): `studio: sp.get('studio') || undefined` + `const sk = sp.get('season'); if (sk === 'current' || sk === 'next') { const s = resolveSeason(sk, new Date()); ... }`.
- [ ] **Step 4: UI.** `bongeszo/page.tsx`: querystring-ből induló szűrő-state (`useSearchParams`) — `/bongeszo?studio=X` működjön linkről; szezon-választó chip: „Aktuális szezon" / „Következő szezon".
- [ ] **Step 5: Teszt + commit.** `git commit -m "feat(bongeszo): studio- es szezon-szuro (current/next) a lokalis browse-ban"`

### Task 10: „Következő szezon" szekció a News-oldalon

**Files:**
- Modify: `src/app/page.tsx` (News), a meglévő szezon-grid minta mellé.

**Interfaces:** Consumes: `GET /api/browse?season=next&type=ANIME` (Task 9) + a meglévő fit-batch flow (`/api/fit/batch`, `FitBadge`/`useFitScores` minta — nézd meg, hogyan használja a mostani szezon-grid, és UGYANAZT a mintát kövesd).

- [ ] **Step 1: Szekció.** „Következő szezon — {SEASON_LABELS[next.season]} {next.year}" fejléc; kártya-rács a browse-válaszból (borító, cím, formátum, fit-badge). Limit: első 18 találat, „továbbiak a böngészőben" link → `/bongeszo?season=next`.
- [ ] **Step 2: Üres állapot:** „Még kevés bejelentett cím — a katalógus-sync bővíti majd."
- [ ] **Step 3: Vizuális + teszt + commit.** `git commit -m "feat(news): kovetkezo szezon szekcio fit-badge-ekkel"`

### Task 11: Címoldal-bővítés (VA, stáb, stúdió-link, SOURCE-kártya)

**Files:**
- Modify: `src/components/CharacterGrid.tsx`, `src/components/CatalogTitlePage.tsx`, `src/lib/catalog-page.ts`, `src/lib/catalog-page.test.ts`, `src/lib/anilist.ts`
- Create: `src/lib/staff-cache.ts` (vékony: AniList staff-query + `api-cache` TTL)

**Interfaces:**
- Produces: `pickSourceRelation(relations: RelationEntry[], mediaType: 'ANIME' | 'MANGA'): RelationEntry | null` (`catalog-page.ts`).
- Produces: `getCachedStaff(anilistId: number, mediaType: 'ANIME' | 'MANGA'): Promise<{ staffId: number; name: string; image: string | null; role: string }[]>` (`staff-cache.ts`, TTL 7 nap, max 6 fő, Director elöl).
- `CharacterEntry`-ben a `vaImage` mező — ha a `fetchCharacters` még nem adja, bővítsd a GraphQL-queryt (a `favorite_characters` tábla már tárol `vaImage`-et, tehát a pipeline nagy részben megvan).

- [ ] **Step 1: Failing test** (`catalog-page.test.ts`-be):

```ts
import { pickSourceRelation } from './catalog-page'

describe('pickSourceRelation', () => {
  const rels = [
    { type: 'SEQUEL', anilistId: 2, title: 'S2' },
    { type: 'SOURCE', anilistId: 10, title: 'Manga' },
    { type: 'ADAPTATION', anilistId: 20, title: 'Anime' },
  ]
  it('ANIME oldalon a SOURCE', () => {
    expect(pickSourceRelation(rels, 'ANIME')?.anilistId).toBe(10)
  })
  it('MANGA oldalon az ADAPTATION', () => {
    expect(pickSourceRelation(rels, 'MANGA')?.anilistId).toBe(20)
  })
  it('nincs talalat -> null', () => {
    expect(pickSourceRelation([{ type: 'SEQUEL', anilistId: 2, title: 'S2' }], 'ANIME')).toBeNull()
  })
})
```

- [ ] **Step 2: FAIL**, majd implementáció (`catalog-page.ts`):

```ts
import type { RelationEntry } from '@/db/schema'

// ANIME oldalon az eredeti mu (SOURCE), MANGA oldalon az adaptacio erdekes.
export function pickSourceRelation(relations: RelationEntry[], mediaType: 'ANIME' | 'MANGA'): RelationEntry | null {
  const want = mediaType === 'ANIME' ? 'SOURCE' : 'ADAPTATION'
  return relations.find((r) => r.type === want) ?? null
}
```

- [ ] **Step 3: VA a karakter-kártyán.** `CharacterGrid`: a kártya alsó sávja kétosztatú — bal: karakter-név, jobb: VA-miniatűr (kerek, 20px) + VA-név; `vaImage` hiányában marad a mostani „CV: név" sor. Query-bővítés az `anilist.ts`-ben, ha kell.
- [ ] **Step 4: Stáb.** `staff-cache.ts`: AniList `staff(perPage: 8, sort: RELEVANCE)` query (`id, name { full }, image { medium }, primaryOccupations` helyett a media-staff él: `staff` edge `role`-lal); szűrés: Director/Original Creator/Character Design/Music elsőbbség, max 6; `api-cache` kulcs: `staff:{mediaType}:{anilistId}`, TTL 7 nap. `CatalogTitlePage`-ben (server) hívva, hiba esetén üres lista (az oldal él stáb nélkül is). Render: kis kör-avataros sor „Stáb" fejléccel a Szereplők-szekció alatt.
- [ ] **Step 5: Stúdió-link.** A chips-sorban a stúdió-chip `<Link href={/bongeszo?studio=...}>`-ra cserélve (csak ANIME-nál).
- [ ] **Step 6: SOURCE-kártya.** `CatalogTitlePage`: `pickSourceRelation` + lokális lookup (`title` tábla, `anilistId` + ellentett mediaType) → ha megvan: kártya borítóval + linkkel a kanonikus oldalra; ha nincs lokálisan: link `https://anilist.co/...` (külső). A „Kapcsolódó" listából a kiemelt elem kimarad.
- [ ] **Step 7: Teszt + tsc + vizuális (egy anime- és egy manga-oldal) + commit.** `git commit -m "feat(cimoldal): VA-k, stab-szekcio, studio-link, eredeti-mu kartya"`

### Task 12: Vibe-presetek bővítése

**Files:**
- Modify: `src/lib/vibe-presets.ts`, `src/lib/vibe-presets.test.ts`

- [ ] **Step 1: Failing test** — az új csoportok léteznek és minden chip-id egyedi:

```ts
it('uj csoportok: helyszin, temak, celkozonseg, forras', () => {
  const groups = VIBE_PRESETS.map((g) => g.group)
  for (const g of ['Helyszín', 'Témák', 'Célközönség', 'Forrás']) expect(groups).toContain(g)
})
it('chip-id-k egyediek', () => {
  const ids = VIBE_PRESETS.flatMap((g) => g.chips.map((c) => c.id))
  expect(new Set(ids).size).toBe(ids.length)
})
```

- [ ] **Step 2: Implementáció** — új csoportok a meglévő formátumban (id-prefixek: `set-`, `th-`, `demo-`, `src-`):
  - **Helyszín**: iskola, fantasy-világ, űr, történelmi, nagyváros;
  - **Témák**: bosszú, sport, zene, pszichológiai, mecha, isekai, időutazás, harcművészet;
  - **Célközönség**: shounen, seinen, shoujo, josei;
  - **Forrás**: manga-adaptáció, light novel, eredeti anime, játék-adaptáció.
  Minden chip `prompt`-ja rövid magyar kifejezés (a GLM-prompt összefűzés változatlan).
- [ ] **Step 3: Teszt + commit.** `git commit -m "feat(vibe): helyszin/temak/celkozonseg/forras chip-csoportok"`

### Task 13: Kitűzés a profilra

**Files:**
- Create: `src/lib/pins.ts`, `src/lib/pins.test.ts`
- Create: `src/app/api/pins/route.ts`
- Modify: `src/components/OwnerOverlay.tsx` (kitűzés-gomb), `src/app/lista/page.tsx` (kártya-gomb), `src/components/CharacterGrid.tsx` (📌 a kedvenceken), `src/app/api/public/[token]/route.ts`, `src/app/p/[token]/page.tsx`, `src/app/stats/page.tsx`, `src/lib/public-view.ts` (whitelist), `src/lib/public-view.test.ts`

**Interfaces:**
- Produces (`pins.ts`): `MAX_PINS = 3`; `validatePins(ids: unknown, allowed: Set<number>): number[]` — dedupol, nem-egész / nem-engedélyezett id-nál és 3 fölött `PinError`-t (message magyarul) dob; `class PinError extends Error`.
- API `GET /api/pins` → `{ titles: { titleId, titleRomaji, coverUrl, slug, mediaType }[]; chars: { charId, name, image }[] }`; `PUT /api/pins` body `{ titles?: number[]; chars?: number[] }` — settings-kulcsok: `pinnedTitles`, `pinnedChars`.
- Publikus payload bővítés: `pinned: { titles: { title, coverUrl, slug, mediaType }[]; chars: { name, image }[] }`.

- [ ] **Step 1: Failing test** (`pins.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { MAX_PINS, PinError, validatePins } from './pins'

describe('validatePins', () => {
  const allowed = new Set([1, 2, 3, 4])
  it('atengedi az ervenyes listat es dedupol', () => {
    expect(validatePins([1, 2, 2], allowed)).toEqual([1, 2])
  })
  it('max 3', () => {
    expect(() => validatePins([1, 2, 3, 4], allowed)).toThrow(PinError)
    expect(MAX_PINS).toBe(3)
  })
  it('nem sajat id -> hiba', () => {
    expect(() => validatePins([99], allowed)).toThrow(PinError)
  })
  it('nem egesz -> hiba', () => {
    expect(() => validatePins(['x'], allowed)).toThrow(PinError)
  })
  it('ures/undefined -> ures lista', () => {
    expect(validatePins(undefined, allowed)).toEqual([])
  })
})
```

- [ ] **Step 2: FAIL**, majd implementáció (`pins.ts`):

```ts
// Profilra kituzheto kedvencek: max 3 cim + max 3 karakter, csak sajat elemek.
export const MAX_PINS = 3

export class PinError extends Error {}

export function validatePins(ids: unknown, allowed: Set<number>): number[] {
  if (ids == null) return []
  if (!Array.isArray(ids)) throw new PinError('Érvénytelen kitűzés-lista')
  const out: number[] = []
  for (const raw of ids) {
    if (!Number.isInteger(raw)) throw new PinError('Érvénytelen azonosító')
    if (!allowed.has(raw)) throw new PinError('Csak saját elemet tűzhetsz ki')
    if (!out.includes(raw)) out.push(raw)
  }
  if (out.length > MAX_PINS) throw new PinError(`Legfeljebb ${MAX_PINS} elemet tűzhetsz ki`)
  return out
}
```

- [ ] **Step 3: Route.** GET: settings-kulcsok olvasása + join a `title`/`favorite_characters` felé a megjelenítendő mezőkért. PUT: `validatePins` — a `titles`-nál az allowed = a user `user_title.titleId`-jai, a `chars`-nál a user `favorite_characters.charId`-jai; `PinError` → 400 a message-dzsel. Mentés a `settings` táblába (`pinnedTitles`, `pinnedChars` kulcsok, upsert a meglévő settings-minta szerint).
- [ ] **Step 4: UI-gombok.** OwnerOverlay: „📌 Kitűzés" toggle (állapot a GET /api/pins-ből; teli kereten 400-hiba toast/inline üzenetként — explicit cserét kér). Lista-kártya: ugyanez kis ikon-gombként. CharacterGrid (nem-readOnly): a már-kedvenc kártyákon második, 📌 gomb.
- [ ] **Step 5: Publikus megjelenés.** `public-view.ts`: `toPublicPinned(...)` a fenti payload-alakkal + teszt rá (vélemény-mező be sem kerülhet — a teszt a kulcs-halmazt fixálja); `/api/public/[token]` bővítés; `/p/[token]` hero: kitűzött borítók (nagyobb kártyák a rács fölött) + karakter-avatarok; `stats` tetején ugyanez a saját adatokból.
- [ ] **Step 6: Teszt + tsc + vizuális + commit.** `git commit -m "feat(profil): kedvenc anime- es karakter-kituzes (max 3) a publikus profilon"`

### Task 14: Wrapped → story-slideshow

**Files:**
- Modify: `src/lib/wrapped.ts`, `src/lib/wrapped.test.ts`
- Create: `src/components/WrappedStory.tsx`
- Modify: `src/app/wrapped/page.tsx` (a slideshow-ra vált), `src/app/api/wrapped/route.ts` (ha a query-hez új mező kell: `status`)

**Interfaces:**
- `WrappedAnimeRow` bővül: `status: string`.
- `WrappedData` bővül: `drops: number; maxEpisodesInDay: number`.
- `WrappedStory` props: `{ data: WrappedData; onExit: () => void }`.

- [ ] **Step 1: Failing test** (`wrapped.test.ts`-be, a meglévő fixture-minta szerint):

```ts
it('drops: az ev aktiv, dropped statuszu cimei', () => {
  const rows = [row({ id: 1, status: 'dropped', watchedAt: '2026-03-01T00:00:00Z' })]
  const w = buildWrapped(rows, [], [], 2026)
  expect(w.drops).toBe(1)
})
it('maxEpisodesInDay: egy nap legtobb epizodja', () => {
  const eps = [ep(1, '2026-02-01T10:00:00Z'), ep(1, '2026-02-01T11:00:00Z'), ep(1, '2026-02-02T10:00:00Z')]
  const w = buildWrapped([row({ id: 1 })], eps, [], 2026)
  expect(w.maxEpisodesInDay).toBe(2)
})
```

(`row`/`ep` helper: ha a meglévő teszt-fájlban van már fixture-gyár, azt használd; ha nincs, hozz létre a fájl tetején.)
- [ ] **Step 2: FAIL**, majd implementáció a `buildWrapped`-ben:

```ts
drops: active.filter((r) => r.status === 'dropped').length,
maxEpisodesInDay: (() => {
  const perDay = new Map<string, number>()
  for (const e of eps) { const d = e.watchedAt.slice(0, 10); perDay.set(d, (perDay.get(d) ?? 0) + 1) }
  return perDay.size ? Math.max(...perDay.values()) : 0
})(),
```

+ a route SELECT-jébe a `status` mező.
- [ ] **Step 3: WrappedStory komponens.** Client; slide-lista a `WrappedData`-ból (üres/null slide-ok kimaradnak): intro (év) → epizód+óra → top műfajok → top stúdiók → top animék (borítókkal) → streak → kedvenc karakterek → dropok („X címet engedtél el idén") → binge-rekord („legtöbb epizód egy nap: N") → manga → záró összefoglaló (minihgrid a fő számokkal). Mechanika:
  - `const [i, setI] = useState(0)`; kattintás jobb 2/3-on → `i+1`, bal 1/3-on → `i-1`; `ArrowRight`/`ArrowLeft` ugyanez; utolsó után `onExit`.
  - progress-sáv felül: szegmens/slide, aktív szegmens kitöltve (`bg-white/80`, inaktív `bg-white/20`).
  - animáció: a slide-tartalom `key={i}` + CSS `animate-[fadeUp_.5s_ease]` (a globals.css-be egy `@keyframes fadeUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }`).
  - fullscreen: `fixed inset-0 z-50 bg-[#09090b]`, kilépés-gomb (✕) jobb felül.
- [ ] **Step 4: Oldal.** `wrapped/page.tsx`: évválasztó marad; „Indítás" → `WrappedStory` nyílik; a régi kártyás összefoglaló megmarad a story alatt/mögött fallbacknek (a story a fő élmény).
- [ ] **Step 5: Teszt + tsc + vizuális (billentyű + kattintás-navigáció, üres-adat év) + commit.** `git commit -m "feat(wrapped): teljes kepernyos story-slideshow uj statokkal"`

### Task 15: Zárás — doksi + teljes verifikáció

**Files:**
- Modify: `docs/FUNKCIOK.md`

- [ ] **Step 1:** `FUNKCIOK.md` frissítése: új oldalak (velemenyek, toplista), üres-állapot, címoldal-bővítés, kitűzés, wrapped-story, export-törlés; a „Nyitott pontok" tábla igazítása.
- [ ] **Step 2:** Teljes kör: `npx tsc --noEmit` + `npm run test` + `npm run build` — mind zöld.
- [ ] **Step 3:** Dev-serveren gyors kattintásos smoke az összes érintett oldalon (/graf zoom, /stats kártya, /bongeszo üres+szűrt, /vs, /p/[token], /velemenyek, /toplista, News next-season, egy anime- és manga-címoldal, /vibe, /wrapped story).
- [ ] **Step 4:** Commit. `git commit -m "docs: funkciolista frissites feature-batch-2 utan"`
