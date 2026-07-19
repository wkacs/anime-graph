# Feature-batch Implementation Plan (manga, karakterek, böngésző, redesignok, duel/szezon-kivezetés)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A jóváhagyott spec (docs/superpowers/specs/2026-07-19-feature-batch-design.md) teljes megvalósítása: manga-mód mediaType-oszloppal, kedvenc-karakter gráfréteg, /bongeszo AniList-katalógus + Random, vertikális MediaCard (News/Vibe/Böngésző), Vibe preset-chipek, Duel+Elo+Szezon kivezetés, belső user-VS, description-oszlop + backfill.

**Architecture:** Egyetlen `anime` tábla marad mindkét médiatípusra (`mediaType` oszlop); leírás DB-ben az own-listára, AniList-válaszból mindenhol máshol. Minden új logika pure fn-ként a `src/lib/`-ben vitest-tel, a route-ok vékonyak. UI a meglévő liquid-glass mintákat követi (glass, label-mono, btn-ghost osztályok).

**Tech Stack:** Next.js 15 App Router + React 19, Drizzle + Neon, AniList GraphQL (kulcs nélkül), vitest.

## Global Constraints

- Node-parancsok a repo gyökeréből: `C:\Users\konig\OneDrive\Dokumentumok\GitHub\anime-graph`.
- Teszt: `npx vitest run` — minden task végén ZÖLD. Build-check csak a kijelölt taskokban (`npm run build`), mert lassú.
- `drizzle-kit` NEM olvassa a `.env.local`-t → push előtt PowerShellben: `$env:DATABASE_URL='<.env.local-ból>'; npx drizzle-kit push`.
- react-force-graph-3d: MINDEN függvény-prop useCallback-kel (perf-lecke). `fgRef.graphData()` NEM létezik.
- `template.tsx`/layout wrapperbe TILOS transform (fixed-overlay bug).
- GLM-hívások: meglévő `glmChat` (AbortSignal.timeout beépítve) — új GLM-hívás ebben a batchben nincs.
- Magyar UI-szövegek, meglévő tónusban. Commit-üzenetek angolul, `feat:`/`refactor:`/`docs:` prefixszel.
- AniList Media ID globálisan egyedi anime+manga közt → `unique(userId, anilistId)` érvényes marad.

---

### Task 1: Séma-bővítés (mediaType, chapters, volumes, description, favorite_characters) + AniList-mezők

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/lib/anilist.ts` (MEDIA_FIELDS, AnilistMedia, mapMedia)
- Test: `src/lib/anilist.test.ts` (mapMedia-teszt bővítés)

**Interfaces:**
- Produces: `anime.mediaType: text('media_type') default 'ANIME'`, `anime.chapters`, `anime.volumes`, `anime.description`; `favoriteCharacters` tábla; `AnilistMedia.type/description/chapters/volumes`; `mapMedia` kimenete tartalmazza mind.

- [ ] **Step 1: Failing teszt** — `src/lib/anilist.test.ts`-be (meglévő mapMedia-teszt mellé):

```ts
it('mapMedia átveszi a mediaType/description/chapters/volumes mezőket', () => {
  const m = makeMedia({ type: 'MANGA', description: '<b>Desc</b>', chapters: 120, volumes: 12, episodes: null })
  const row = mapMedia(m)
  expect(row.mediaType).toBe('MANGA')
  expect(row.description).toBe('<b>Desc</b>')
  expect(row.chapters).toBe(120)
  expect(row.volumes).toBe(12)
})
```

(A fájlban lévő media-factory helpert bővítsd a 4 új mezővel default-tal: `type: 'ANIME', description: null, chapters: null, volumes: null`.)

- [ ] **Step 2: Futtatás — FAIL** — `npx vitest run src/lib/anilist.test.ts` → hiba: mediaType undefined.

- [ ] **Step 3: Implementáció**

`src/db/schema.ts` — az `anime` táblába a `format` sor után:

```ts
  mediaType: text('media_type').notNull().default('ANIME'), // ANIME | MANGA
  chapters: integer('chapters'),
  volumes: integer('volumes'),
  description: text('description'), // AniList description (nyers HTML, strip megjelenítéskor)
```

Új tábla a `duels` elé:

```ts
export const favoriteCharacters = pgTable('favorite_characters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  charId: integer('char_id').notNull(), // AniList character id
  name: text('name').notNull(),
  image: text('image'),
  vaId: integer('va_id'),
  vaName: text('va_name'),
  vaImage: text('va_image'),
  animeId: integer('anime_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('favchar_user_char_unique').on(t.userId, t.charId),
])
```

`src/lib/anilist.ts`:
- `AnilistMedia` típusba: `type: string | null`, `description: string | null`, `chapters: number | null`, `volumes: number | null`.
- `MEDIA_FIELDS`-be új sorok: `type`, `description`, `chapters`, `volumes`.
- `mapMedia`-ba: `mediaType: m.type ?? 'ANIME'`, `description: m.description`, `chapters: m.chapters`, `volumes: m.volumes`.
- `MEDIA_QUERY`-ből és `MAL_BATCH_QUERY`-ből a `type: ANIME` szűrő MARAD (a Media(id) egyedi, de a meglévő viselkedés ne változzon itt — a manga-fetch a Task 8-ban jön `fetchMedia` type-paraméterrel).

- [ ] **Step 4: Futtatás — PASS** — `npx vitest run src/lib/anilist.test.ts`.

- [ ] **Step 5: DB-push a Neonra** (PowerShell, DATABASE_URL a .env.local-ból):

```powershell
$env:DATABASE_URL='<érték>'; npx drizzle-kit push
```

Elvárt: additív oszlopok + `favorite_characters` tábla, interaktív prompt nélkül lefut. Ha destruktív műveletet ajánlana → ÁLLJ, kézi SQL (multi-tenant precedens).

- [ ] **Step 6: Teljes teszt + commit**

```bash
npx vitest run
git add -A && git commit -m "feat: schema + AniList fields for mediaType, chapters, volumes, description, favorite characters"
```

---

### Task 2: Description-backfill script a meglévő animékre

**Files:**
- Create: `scripts/backfill-descriptions.mjs`

**Interfaces:**
- Consumes: `anime` tábla (description IS NULL sorok), AniList `Page(media(id_in:...))`.
- Produces: feltöltött `description` oszlop; idempotens (újrafuttatható).

- [ ] **Step 1: Script megírása** — `scripts/backfill-descriptions.mjs`:

```js
// egyszeri backfill: minden description-nélküli sorhoz AniList-leírás, 50-es batchekben
// futtatás: node scripts/backfill-descriptions.mjs  (DATABASE_URL env kell)
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const rows = await sql`SELECT DISTINCT anilist_id FROM anime WHERE description IS NULL`
const ids = rows.map((r) => r.anilist_id)
console.log(`${ids.length} anime leírás nélkül`)

for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50)
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($ids: [Int!]) { Page(perPage: 50) { media(id_in: $ids) { id description } } }`,
      variables: { ids: batch },
    }),
  })
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  for (const m of json.data.Page.media) {
    if (m.description) {
      await sql`UPDATE anime SET description = ${m.description} WHERE anilist_id = ${m.id} AND description IS NULL`
    }
  }
  console.log(`${Math.min(i + 50, ids.length)}/${ids.length}`)
  await new Promise((r) => setTimeout(r, 700)) // AniList rate limit alatt maradunk
}
console.log('kész')
```

- [ ] **Step 2: Futtatás a Neonra** (PowerShell):

```powershell
$env:DATABASE_URL='<érték>'; node scripts/backfill-descriptions.mjs
```

Elvárt: `... kész`, majd ellenőrzés: `SELECT count(*) FROM anime WHERE description IS NULL` közel 0 (ami AniList-en sincs, az null marad — ez oké).

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-descriptions.mjs && git commit -m "feat: one-off description backfill script"
```

---

### Task 3: Duel + Szezon + Elo kivezetés

**Files:**
- Delete: `src/app/duel/` (teljes), `src/app/api/duel/` (teljes, stats-szal), `src/lib/elo.ts`, `src/lib/elo.test.ts`
- Delete (feltételes, lásd Step 1): `src/app/szezon/page.tsx`, `src/app/api/szezon/route.ts`, `src/lib/seasonal.ts` + tesztje
- Modify: `src/components/TopNav.tsx`, `src/lib/recommend.ts`, `src/lib/recommend.test.ts`, `src/app/api/recommend/route.ts`, `src/app/stats/page.tsx`, `src/lib/graph-builder.ts`, `src/components/HierarchyPanel.tsx`

**Interfaces:**
- Produces: nav = News|Gráf|Lista|Böngésző|Vibe|Stats|VS (a Böngésző-fül href-je `/bongeszo`, az oldal a Task 6-ban jön — 404 addig elfogadott dev-ben, de a fül csak a Task 6 után kerül be, lásd Step 4); `RecommendExtras = { dropped?: string[] }`; `GraphConfig.sizeBy` mező TÖRÖLVE.

- [ ] **Step 1: Használat-térkép** — törlés előtt:

```bash
grep -rn "elo\|/api/duel\|seasonal\|/api/szezon" src --include="*.ts" --include="*.tsx" -l
```

Döntés: `seasonal.ts`-t és `/api/szezon`-t CSAK akkor töröld, ha a News (`src/app/page.tsx`, `src/app/api/news/`) nem hivatkozza. Ha a News használja a seasonal ízlés-score cache-olvasást, az olvasó kód marad, csak a `/szezon` OLDAL + a nav-fül megy.

- [ ] **Step 2: Törlések + nav** — a Step 1 térképe szerint töröld a fájlokat. `TopNav.tsx` TABS:

```ts
const TABS: { href: string; label: string; soon?: boolean }[] = [
  { href: '/', label: 'News' },
  { href: '/graf', label: 'Gráf' },
  { href: '/lista', label: 'Lista' },
  { href: '/vibe', label: 'Vibe' },
  { href: '/stats', label: 'Stats' },
  { href: '/vs', label: 'VS' },
]
```

(Böngésző-fül a Task 6-ban kerül be, hogy ne legyen halott link.)

- [ ] **Step 3: recommend.ts** — `RecommendExtras`-ból `eloTop` és `recentDuels` ki, a `buildRecommendMessages` extraBlocks-ból a két elo-blokk ki (a `dropped` marad). `src/app/api/recommend/route.ts`-ből az elo-top5 + utolsó-duelek lekérdezés ki. `recommend.test.ts`-ből az elo-s asserted blokkok ki, dropped-teszt marad.

- [ ] **Step 4: Stats + gráf-config** — `stats/page.tsx`-ből az Elo-top10/utolsó-meccsek szekció ki (a `/api/duel/stats` fetch-csel együtt). `graph-builder.ts`: `GraphConfig`-ból `sizeBy` mező ki, `buildGraph`-ban `val: a.myScore ?? 5`, `buildBubbles` cover-rendezésből az `|| y.elo - x.elo` tiebreak ki; `GraphAnime`-ból az `elo` mező ki. `HierarchyPanel.tsx`-ből a sizeBy-választó ki. A gráf-oldali (`graf/page.tsx`) sorleképezésből az `elo` mező átadása ki.

- [ ] **Step 5: Teszt + build + commit**

```bash
npx vitest run && npm run build
git add -A && git commit -m "refactor: remove duel, elo and season page; slim nav and recommend prompt"
```

Elvárt: minden megmaradó teszt zöld (elo.test.ts már nincs), build zöld — nincs törött import.

---

### Task 4: description-utilok + MediaCard komponens

**Files:**
- Create: `src/lib/description.ts`
- Test: `src/lib/description.test.ts`
- Create: `src/components/MediaCard.tsx`

**Interfaces:**
- Produces: `stripHtml(html: string | null): string`, `clampText(s: string, max?: number): string` (default max=180, szóhatáron vág, `…`);
  `MediaCard` props: `{ title: string; coverUrl: string | null; genres: string[]; description?: string | null; href?: string; badge?: ReactNode; footer?: ReactNode }` — vertikális: borító (2:3, next/image) → cím → halvány műfaj-sor → line-clamp-3 leírás → footer-slot.

- [ ] **Step 1: Failing tesztek** — `src/lib/description.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { stripHtml, clampText } from './description'

describe('stripHtml', () => {
  it('tageket és <br>-t eltávolít, entitásokat dekódol', () => {
    expect(stripHtml('<b>Hi</b><br>ott&amp;itt <i>x</i>')).toBe('Hi ott&itt x')
  })
  it('null-ra üres string', () => {
    expect(stripHtml(null)).toBe('')
  })
})

describe('clampText', () => {
  it('rövid szöveget nem bánt', () => {
    expect(clampText('rövid', 180)).toBe('rövid')
  })
  it('szóhatáron vág és …-t tesz', () => {
    const out = clampText('a'.repeat(100) + ' vége hosszú szöveg', 105)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(106)
  })
})
```

- [ ] **Step 2: FAIL** — `npx vitest run src/lib/description.test.ts` → modul nem létezik.

- [ ] **Step 3: Implementáció** — `src/lib/description.ts`:

```ts
// AniList description: nyers HTML (b/i/br + entitások) → sima szöveg kártyákra
export function stripHtml(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function clampText(s: string, max = 180): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…'
}
```

- [ ] **Step 4: PASS** — `npx vitest run src/lib/description.test.ts`.

- [ ] **Step 5: MediaCard** — `src/components/MediaCard.tsx` (a meglévő glass-kártya stílusjegyeivel; nem client-komponens, nincs state):

```tsx
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { stripHtml, clampText } from '@/lib/description'

type Props = {
  title: string
  coverUrl: string | null
  genres: string[]
  description?: string | null
  href?: string
  badge?: ReactNode
  footer?: ReactNode
}

export default function MediaCard({ title, coverUrl, genres, description, href, badge, footer }: Props) {
  const desc = clampText(stripHtml(description ?? null))
  const cover = (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-white/5">
      {coverUrl && (
        <Image src={coverUrl} alt={title} fill sizes="220px" className="object-cover" />
      )}
      {badge && <div className="absolute top-2 right-2">{badge}</div>}
    </div>
  )
  return (
    <div className="glass rounded-2xl p-3 flex flex-col gap-2">
      {href ? <Link href={href}>{cover}</Link> : cover}
      <div className="min-w-0">
        {href
          ? <Link href={href} className="text-sm font-medium text-text-1 line-clamp-2 hover:underline">{title}</Link>
          : <span className="text-sm font-medium text-text-1 line-clamp-2">{title}</span>}
        <p className="text-[11px] text-text-3 truncate">{genres.slice(0, 3).join(' · ')}</p>
        {desc && <p className="mt-1 text-xs text-text-2 line-clamp-3">{desc}</p>}
      </div>
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  )
}
```

- [ ] **Step 6: Teszt + commit**

```bash
npx vitest run
git add -A && git commit -m "feat: MediaCard component and description strip/clamp utils"
```

---

### Task 5: News vertikális redesign

**Files:**
- Modify: `src/app/page.tsx` (követett-kártyák + szezon-grid → MediaCard)
- Modify: a News adat-útvonala (`src/app/api/news/route.ts` és/vagy az ott használt AniList-query): `description` mező hozzáadása a szezon/követett lekérdezésekhez

**Interfaces:**
- Consumes: `MediaCard`, `stripHtml/clampText` (Task 4).
- Produces: a News API válasz-elemei `description: string | null` mezővel; digest/TonightPicker/heti naptár/countdown VÁLTOZATLAN.

- [ ] **Step 1: News API** — a News-t kiszolgáló AniList-query-kbe (`src/app/api/news/route.ts`-ben vagy az általa hívott anilist.ts-fetchekben — kövesd az importokat) vedd fel a `description` mezőt és add tovább a válasz-objektumban. A `SEASON_QUERY`-be (anilist.ts) is: `description`, és a `SeasonMedia` típus + mapper bővül `description: string | null`-lal.

- [ ] **Step 2: Kártya-csere** — `src/app/page.tsx`: az „Amit követsz" kártya és a szezon-grid kártya markupját cseréld `MediaCard`-ra. Countdown a `badge` slotba (a meglévő `Countdown` komponens), a „+1 rész" / „+Tervezem" / ízlés-score elemek a `footer` slotba. A szekció-struktúra, digest, TonightPicker, heti naptár marad.
  Grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`.

- [ ] **Step 3: Vizuális gyors-check dev-ben** — `npm run dev`, `/` betölt, kártyák: kép→cím→halvány műfaj→leírás; countdown továbbra is tikkel. (Ha a dev előtte build-del futott: `.next` törlés.)

- [ ] **Step 4: Teszt + commit**

```bash
npx vitest run
git add -A && git commit -m "feat: vertical MediaCard layout on News with descriptions"
```

---

### Task 6: Böngésző lib + API + oldal + Random

**Files:**
- Create: `src/lib/browse.ts`
- Test: `src/lib/browse.test.ts`
- Modify: `src/lib/anilist.ts` (BROWSE_QUERY + fetchBrowse)
- Create: `src/app/api/browse/route.ts`
- Create: `src/app/bongeszo/page.tsx`
- Modify: `src/components/TopNav.tsx` (Böngésző-fül be)

**Interfaces:**
- Produces:
  - `type BrowseFilters = { search?: string; type: 'ANIME' | 'MANGA'; genre?: string; year?: number; format?: string; minScore?: number; sort: 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC'; page: number }`
  - `buildBrowseVariables(f: BrowseFilters): Record<string, unknown>` — csak a kitöltött szűrőkből; év: ANIME→`seasonYear`, MANGA→`startDateGreater/startDateLesser` (FuzzyDateInt: `year*10000`, `(year+1)*10000`).
  - `randomPage(total: number, perPage: number): number` — 1-alapú, cap: `Math.min(Math.ceil(total/perPage), Math.floor(5000/perPage))`, üres találatnál 1. Determinisztikus rand-injektálással tesztelhető: második paraméter `rnd: () => number`.
  - `fetchBrowse(variables: Record<string, unknown>): Promise<{ total: number; media: BrowseMedia[] }>` ahol `BrowseMedia = { anilistId, title, coverUrl, genres, avgScore, format, year, description }` (a variables a `buildBrowseVariables` kimenete + `sort` listává alakítva).
  - `GET /api/browse?{szűrők}` → `{ total, media }`; `GET /api/browse?{szűrők}&random=1` → `{ media: [egyetlen] }`.

- [ ] **Step 1: Failing tesztek** — `src/lib/browse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildBrowseVariables, randomPage } from './browse'

describe('buildBrowseVariables', () => {
  it('üres szűrők: csak type+sort+page kerül be', () => {
    const v = buildBrowseVariables({ type: 'ANIME', sort: 'POPULARITY_DESC', page: 1 })
    expect(v).toEqual({ type: 'ANIME', sort: 'POPULARITY_DESC', page: 1, perPage: 24 })
  })
  it('anime-évből seasonYear lesz', () => {
    const v = buildBrowseVariables({ type: 'ANIME', sort: 'SCORE_DESC', page: 2, year: 2020 })
    expect(v.seasonYear).toBe(2020)
    expect(v.startDateGreater).toBeUndefined()
  })
  it('manga-évből FuzzyDateInt-tartomány lesz', () => {
    const v = buildBrowseVariables({ type: 'MANGA', sort: 'SCORE_DESC', page: 1, year: 2015 })
    expect(v.startDateGreater).toBe(20150000)
    expect(v.startDateLesser).toBe(20160000)
    expect(v.seasonYear).toBeUndefined()
  })
  it('search/genre/format/minScore átmegy', () => {
    const v = buildBrowseVariables({ type: 'ANIME', sort: 'POPULARITY_DESC', page: 1, search: 'naruto', genre: 'Action', format: 'MOVIE', minScore: 70 })
    expect(v.search).toBe('naruto')
    expect(v.genre).toBe('Action')
    expect(v.format).toBe('MOVIE')
    expect(v.minScore).toBe(70)
  })
})

describe('randomPage', () => {
  it('cap 5000 elemnél: perPage=24-gyel max 208. oldal', () => {
    expect(randomPage(999999, 24, () => 0.9999)).toBe(208)
  })
  it('kis találati halmaz: total szerint', () => {
    expect(randomPage(30, 24, () => 0.9)).toBe(2)
  })
  it('üres: 1', () => {
    expect(randomPage(0, 24, () => 0.5)).toBe(1)
  })
})
```

- [ ] **Step 2: FAIL** — `npx vitest run src/lib/browse.test.ts`.

- [ ] **Step 3: Implementáció** — `src/lib/browse.ts`:

```ts
export type BrowseFilters = {
  search?: string
  type: 'ANIME' | 'MANGA'
  genre?: string
  year?: number
  format?: string
  minScore?: number
  sort: 'POPULARITY_DESC' | 'SCORE_DESC' | 'START_DATE_DESC'
  page: number
}

export const BROWSE_PER_PAGE = 24
// az AniList lapozás page*perPage <= 5000-ig ad eredményt
const ANILIST_PAGE_CAP = 5000

export function buildBrowseVariables(f: BrowseFilters): Record<string, unknown> {
  const v: Record<string, unknown> = { type: f.type, sort: f.sort, page: f.page, perPage: BROWSE_PER_PAGE }
  if (f.search) v.search = f.search
  if (f.genre) v.genre = f.genre
  if (f.format) v.format = f.format
  if (f.minScore) v.minScore = f.minScore
  if (f.year) {
    if (f.type === 'ANIME') v.seasonYear = f.year
    else {
      v.startDateGreater = f.year * 10000
      v.startDateLesser = (f.year + 1) * 10000
    }
  }
  return v
}

export function randomPage(total: number, perPage: number, rnd: () => number = Math.random): number {
  const maxPage = Math.min(Math.ceil(total / perPage), Math.floor(ANILIST_PAGE_CAP / perPage))
  if (maxPage < 1) return 1
  return 1 + Math.floor(rnd() * maxPage)
}
```

- [ ] **Step 4: PASS** — `npx vitest run src/lib/browse.test.ts`.

- [ ] **Step 5: fetchBrowse az anilist.ts-be**

```ts
export type BrowseMedia = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  format: string | null
  year: number | null
  description: string | null
}

const BROWSE_QUERY = `
query ($type: MediaType!, $sort: [MediaSort], $page: Int!, $perPage: Int!, $search: String,
       $genre: String, $format: MediaFormat, $minScore: Int, $seasonYear: Int,
       $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total }
    media(type: $type, sort: $sort, search: $search, genre: $genre, format: $format,
          averageScore_greater: $minScore, seasonYear: $seasonYear,
          startDate_greater: $startDateGreater, startDate_lesser: $startDateLesser) {
      id
      title { romaji }
      coverImage { large }
      genres
      averageScore
      format
      seasonYear
      startDate { year }
      description
    }
  }
}`

export async function fetchBrowse(variables: Record<string, unknown>): Promise<{ total: number; media: BrowseMedia[] }> {
  type R = { Page: { pageInfo: { total: number }; media: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null; format: string | null; seasonYear: number | null; startDate: { year: number | null } | null; description: string | null }[] } }
  const data = await anilistFetch<R>(BROWSE_QUERY, variables)
  return {
    total: data.Page.pageInfo.total,
    media: data.Page.media.map((m) => ({
      anilistId: m.id,
      title: m.title.romaji,
      coverUrl: m.coverImage?.large ?? null,
      genres: m.genres,
      avgScore: m.averageScore,
      format: m.format,
      year: m.seasonYear ?? m.startDate?.year ?? null,
      description: m.description,
    })),
  }
}
```

Megjegyzés: `$sort` `[MediaSort]` listaként megy — a route adja át `[f.sort]`-ként.

- [ ] **Step 6: API route** — `src/app/api/browse/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { fetchBrowse } from '@/lib/anilist'
import { buildBrowseVariables, randomPage, BROWSE_PER_PAGE, type BrowseFilters } from '@/lib/browse'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

function parseFilters(sp: URLSearchParams): BrowseFilters {
  const type = sp.get('type') === 'MANGA' ? 'MANGA' as const : 'ANIME' as const
  const sortRaw = sp.get('sort')
  const sort = sortRaw === 'SCORE_DESC' || sortRaw === 'START_DATE_DESC' ? sortRaw : 'POPULARITY_DESC' as const
  return {
    type, sort,
    page: Math.max(1, Number(sp.get('page')) || 1),
    search: sp.get('search') || undefined,
    genre: sp.get('genre') || undefined,
    format: sp.get('format') || undefined,
    year: Number(sp.get('year')) || undefined,
    minScore: Number(sp.get('minScore')) || undefined,
  }
}

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const filters = parseFilters(sp)
  const vars = buildBrowseVariables(filters)
  vars.sort = [filters.sort]
  try {
    if (sp.get('random') === '1') {
      const probe = await fetchBrowse({ ...vars, page: 1, perPage: 1 })
      if (!probe.total) return NextResponse.json({ error: 'Nincs találat ezekkel a szűrőkkel' }, { status: 404 })
      const page = randomPage(probe.total, 1)
      const pick = await fetchBrowse({ ...vars, page, perPage: 1 })
      return NextResponse.json({ media: pick.media })
    }
    const result = await fetchBrowse(vars)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
  }
}
```

(Randomnál perPage=1-gyel megy a lapozás, így a cap 5000 TALÁLATIG enged — a `randomPage(total, 1)` pontosan ezt adja.)

- [ ] **Step 7: Oldal** — `src/app/bongeszo/page.tsx` client-komponens:
  - Szűrő-sor felül (glass-pill): keresőmező, típus-váltó (Anime/Manga), műfaj-select (a fix AniList-műfajlista: Action, Adventure, Comedy, Drama, Fantasy, Horror, Mahou Shoujo, Mecha, Music, Mystery, Psychological, Romance, Sci-Fi, Slice of Life, Sports, Supernatural, Thriller), év-input, formátum-select (TV/MOVIE/OVA/ONA/SPECIAL ill. MANGA-nál MANGA/NOVEL/ONE_SHOT), min. pont-select (70/80/85), rendezés-select, **Random gomb** (dobókocka-emoji 🎲 + „Random").
  - Állapot: `filters` state; fetch `/api/browse?...` a szűrő-változásra (useEffect, 300ms debounce a search-re); `Betöltés…` skeleton.
  - Találatok: `MediaCard`-grid (Task 5 grid-osztályai); `href`: ha a saját listán van → `/anime/[dbId]`, különben `/anime/preview/[anilistId]` (a saját lista `anilistId→id` map-je a meglévő `GET /api/anime`-ből, egyszer letöltve).
  - `footer` slot: Láttam/Nézem/Terv gyorsgombok — `POST /api/anime` `{ anilistId, status }` (AddAnimeSearch mintája), siker után a gomb-sor helyén „✓ listán".
  - Lapozás: Előző/Következő gombok + `total` kiírás.
  - Random gomb: `GET /api/browse?...&random=1` → `router.push` a fenti href-logika szerint.
- [ ] **Step 8: Nav-fül** — `TopNav.tsx` TABS-ba a Lista után: `{ href: '/bongeszo', label: 'Böngésző' }`.

- [ ] **Step 9: Dev-check + teszt + commit** — dev-ben `/bongeszo`: szűrés, lapozás, gyorsgomb, Random mind él.

```bash
npx vitest run
git add -A && git commit -m "feat: browse page with AniList catalog filters and random pick"
```

---

### Task 7: Preview-oldal (`/anime/preview/[anilistId]`)

**Files:**
- Create: `src/app/anime/preview/[anilistId]/page.tsx`
- Create: `src/components/PreviewAddButtons.tsx`
- Modify: `src/lib/anilist.ts` (`fetchMedia` type-paraméter)

**Interfaces:**
- Consumes: `stripHtml`, POST `/api/anime`.
- Produces: `fetchMedia(anilistId: number, any?: boolean)` — `any=true` → Media(id) típus-szűrő nélkül (preview mindkét médiatípust kiszolgálja); default a mostani ANIME-szűrős viselkedés.

- [ ] **Step 1: fetchMedia bővítés** — `anilist.ts`: a `MEDIA_QUERY`-ből két változat helyett paraméterezés:

```ts
const MEDIA_QUERY_ANY = `
query ($id: Int!) {
  Media(id: $id) {${MEDIA_FIELDS}
  }
}`

export async function fetchMedia(anilistId: number, any = false): Promise<AnilistMedia> {
  const data = await anilistFetch<{ Media: AnilistMedia }>(any ? MEDIA_QUERY_ANY : MEDIA_QUERY, { id: anilistId })
  return data.Media
}
```

(Meglévő hívók változatlanok — default a mostani ANIME-szűrős query.)

- [ ] **Step 2: Preview-oldal** — server component: `const media = await fetchMedia(Number(params.anilistId), true)`; ha a sor a user listáján van (db-lookup `(userId, anilistId)`-re), `redirect(`/anime/${row.id}`)`. Render: banner/borító, cím (romaji+english+native), műfaj-chipek, formátum/év/epizód-vagy-fejezet, teljes `stripHtml(media.description)` leírás, `PreviewAddButtons` (client): Láttam/Nézem/Terv → `POST /api/anime { anilistId, status }` → siker után `router.push('/anime/' + data.anime.id)`. Trailer-embed, ha van (`media.trailer`), a meglévő anime-oldali minta szerint.

- [ ] **Step 3: Dev-check + commit** — `/anime/preview/1` (Cowboy Bebop) betölt; hozzáadás átvisz a rendes oldalra.

```bash
npx vitest run
git add -A && git commit -m "feat: anime preview page for titles not on the list"
```

---

### Task 8: Manga-mód (add-flow, lista/gráf toggle, import, detail)

**Files:**
- Modify: `src/lib/anilist.ts` (searchAnime type-param, LIST_QUERY type-param)
- Modify: `src/app/api/anilist/search/route.ts` (type query-param átadás)
- Modify: `src/components/AddAnimeSearch.tsx` (Anime/Manga váltó)
- Modify: `src/app/api/anime/route.ts` (POST: preview-ből jövő manga — `fetchMedia(anilistId, true)`)
- Modify: `src/lib/graph-builder.ts` + `src/lib/graph-builder.test.ts` (mediaType-szűrő)
- Modify: `src/app/graf/page.tsx`, `src/app/lista/page.tsx` (Anime/Manga/Mind toggle)
- Modify: `src/app/anime/[id]/page.tsx` (fejezet-címkék mangánál)
- Modify: `src/app/api/import/anilist/route.ts` (manga-lista is)

**Interfaces:**
- Produces: `searchAnime(q: string, type?: 'ANIME' | 'MANGA')`; `fetchUserList(userName: string, type?: 'ANIME' | 'MANGA')`; `filterByMedia(rows: { mediaType: string }[], mode: MediaMode)` pure fn a graph-builderben, `type MediaMode = 'ANIME' | 'MANGA' | 'ALL'`; `GraphAnime.mediaType: string`.

- [ ] **Step 1: Failing teszt** — `graph-builder.test.ts`:

```ts
it('filterByMedia szűr mediaType-ra, ALL mindent visszaad', () => {
  const rows = [{ mediaType: 'ANIME' }, { mediaType: 'MANGA' }, { mediaType: 'ANIME' }]
  expect(filterByMedia(rows, 'ANIME')).toHaveLength(2)
  expect(filterByMedia(rows, 'MANGA')).toHaveLength(1)
  expect(filterByMedia(rows, 'ALL')).toHaveLength(3)
})
```

- [ ] **Step 2: FAIL, majd implementáció** — `graph-builder.ts`:

```ts
export type MediaMode = 'ANIME' | 'MANGA' | 'ALL'

export function filterByMedia<T extends { mediaType: string }>(rows: T[], mode: MediaMode): T[] {
  return mode === 'ALL' ? rows : rows.filter((r) => r.mediaType === mode)
}
```

`GraphAnime`-ba: `mediaType: string`. PASS: `npx vitest run src/lib/graph-builder.test.ts`.

- [ ] **Step 3: Search + add-flow** — `anilist.ts`: `SEARCH_QUERY` kap `$type: MediaType!` változót (`media(search: $search, type: $type)`), `searchAnime(q, type = 'ANIME')`. `api/anilist/search/route.ts`: `type` query-param átadása (default ANIME). `AddAnimeSearch.tsx`: kis Anime/Manga váltó-pill a kereső mellett, a választás megy a search-hívásba. `api/anime/route.ts` POST: `fetchMedia(anilistId, true)` (típus-szűrő nélkül — így manga-id-ra is működik; a `mapMedia` a `type` mezőből tölti a `mediaType`-ot).

- [ ] **Step 4: Gráf + lista toggle** — `graf/page.tsx`: `mediaMode` state (localStorage kulcs: `anime-graph-media`, default `'ANIME'`), toggle-pill a meglévő nézet-váltók mellé (Anime | Manga | Mind), a sorok a `filterByMedia`-n át mennek `buildBubbles`/`buildGenreDetail`/`buildGraph`/`buildTimeline` felé; a sorleképezésbe `mediaType: r.mediaType`. `lista/page.tsx`: ugyanez a hármas toggle a meglévő szűrősor elején.

- [ ] **Step 5: Detail + import** — `anime/[id]/page.tsx`: ha `mediaType === 'MANGA'` → „rész" helyett „fejezet" címkék, progress-max `chapters ?? volumes`, formátum-chipben „MANGA"; a meglévő +1 gomb és Befejezted-modal változatlan logikával. `api/import/anilist/route.ts`: `fetchUserList(userName)` mellett `fetchUserList(userName, 'MANGA')` is (LIST_QUERY `$type: MediaType!` változóval), a két lista együtt megy a meglévő batched upsertbe.

- [ ] **Step 5b: Manga-kizárás az anime-only feature-ökből** (spec: Recommend/Vibe/News/TonightPicker manga-t NEM kap) — `eq(anime.mediaType, 'ANIME')` szűrő a saját-lista lekérdezésekbe itt: `api/recommend/route.ts` (top-lista + jelölt-pool seedek), `api/vibe/route.ts` (own-lista blokk), `api/news/route.ts` (követett/airing saját sorok), TonightPicker adatforrása (`pickTonight` hívási helye). A gráf/lista/stats/export mangát IS lát — ott a Task 8 toggle szűr.

- [ ] **Step 6: Teszt + build + commit**

```bash
npx vitest run && npm run build
git add -A && git commit -m "feat: manga mode - search toggle, media filter on graph and list, manga import, chapter labels"
```

---

### Task 9: Karakterek — API + anime-oldali Szereplők szekció

**Files:**
- Create: `src/app/api/characters/[anilistId]/route.ts`
- Create: `src/app/api/characters/favorite/route.ts`
- Create: `src/components/CharacterGrid.tsx`
- Modify: `src/app/anime/[id]/page.tsx` (szekció beillesztés)
- Modify: `src/lib/anilist.ts` (CHARACTERS_QUERY + fetchCharacters)

**Interfaces:**
- Produces:
  - `fetchCharacters(anilistId: number): Promise<CharacterEntry[]>` ahol `CharacterEntry = { charId: number; name: string; image: string | null; role: string; vaId: number | null; vaName: string | null; vaImage: string | null }`
  - `GET /api/characters/[anilistId]` → `{ characters: CharacterEntry[], favoriteIds: number[] }`
  - `POST /api/characters/favorite` body `{ charId, name, image, vaId, vaName, vaImage, animeId }` → upsert; `DELETE` body `{ charId }` → törlés.

- [ ] **Step 1: fetchCharacters** — `anilist.ts`:

```ts
export type CharacterEntry = {
  charId: number
  name: string
  image: string | null
  role: string
  vaId: number | null
  vaName: string | null
  vaImage: string | null
}

const CHARACTERS_QUERY = `
query ($id: Int!) {
  Media(id: $id) {
    characters(role_in: [MAIN, SUPPORTING], perPage: 12, sort: [ROLE, RELEVANCE]) {
      edges {
        role
        node { id name { full } image { medium } }
        voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full } image { medium } }
      }
    }
  }
}`

export async function fetchCharacters(anilistId: number): Promise<CharacterEntry[]> {
  type R = { Media: { characters: { edges: { role: string; node: { id: number; name: { full: string }; image: { medium: string | null } | null }; voiceActors: { id: number; name: { full: string }; image: { medium: string | null } | null }[] }[] } } }
  const data = await anilistFetch<R>(CHARACTERS_QUERY, { id: anilistId })
  return data.Media.characters.edges.map((e) => ({
    charId: e.node.id,
    name: e.node.name.full,
    image: e.node.image?.medium ?? null,
    role: e.role,
    vaId: e.voiceActors[0]?.id ?? null,
    vaName: e.voiceActors[0]?.name.full ?? null,
    vaImage: e.voiceActors[0]?.image?.medium ?? null,
  }))
}
```

- [ ] **Step 2: Route-ok** — `api/characters/[anilistId]/route.ts`: `requireUserId` → `fetchCharacters` + a user `favorite_characters` charId-jai (`favoriteIds`). `api/characters/favorite/route.ts`: POST = `insert ... onConflictDoNothing` a `(userId, charId)` unique-ra, body-validálás (charId/name/animeId kötelező, animeId ownership-check a saját anime-sorra); DELETE = `delete where (userId, charId)`.

- [ ] **Step 3: CharacterGrid (client)** — props: `{ anilistId: number; animeId: number }`; mount-kor fetch `GET /api/characters/[anilistId]`; kártya-rács (kép, név, alatta halványan seiyuu-név `CV: …`), jobb-felső szív-gomb (♡/♥) → POST/DELETE + optimista state. Beillesztés az `anime/[id]/page.tsx`-be a témék/trailer szekció után „Szereplők" címmel. AniList karakter-képek domainje: `next.config.ts` `images.remotePatterns`-be `s4.anilist.co` már fent van — ellenőrizd, hogy a karakter-képek is `s4.anilist.co`-ról jönnek (igen, ugyanaz a CDN).

- [ ] **Step 4: Dev-check + teszt + commit** — egy anime-oldalon a szereplők betöltenek, szívezés túléli a reloadot.

```bash
npx vitest run
git add -A && git commit -m "feat: character section with favorites on anime page"
```

---

### Task 10: Karakter gráf-réteg (same-seiyuu keresztélek)

**Files:**
- Modify: `src/lib/graph-builder.ts` + Test: `src/lib/graph-builder.test.ts`
- Modify: `src/app/graf/page.tsx` (réteg-toggle + adat-fetch)
- Modify: `src/components/Graph3D.tsx` (char-node render)
- Modify: `src/app/api/anime/route.ts` VAGY új `GET /api/characters/favorites` (összes kedvenc lekérés — új route javasolt)

**Interfaces:**
- Consumes: `favorite_characters` sorok `{ charId, name, image, vaId, vaName, animeId }`.
- Produces: `buildCharacterLayer(favs: FavChar[], visibleAnimeIds: Set<number>): { nodes: GraphNode[]; links: GraphLink[] }` ahol `FavChar = { charId: number; name: string; image: string | null; vaId: number | null; vaName: string | null; animeId: number }`; `GraphNode.type` bővül `'char'`-ral; `GraphLink.kind` bővül `'char' | 'seiyuu'`-val.

- [ ] **Step 1: Failing teszt** — `graph-builder.test.ts`:

```ts
describe('buildCharacterLayer', () => {
  const favs = [
    { charId: 1, name: 'Lelouch', image: null, vaId: 95270, vaName: 'Fukuyama Jun', animeId: 10 },
    { charId: 2, name: 'Ichigo', image: null, vaId: 95270, vaName: 'Fukuyama Jun', animeId: 20 },
    { charId: 3, name: 'Levi', image: null, vaId: 95100, vaName: 'Kamiya Hiroshi', animeId: 30 },
  ]
  it('char-node + él a saját animéhez, csak látható animékre', () => {
    const { nodes, links } = buildCharacterLayer(favs, new Set([10, 20]))
    expect(nodes.map((n) => n.id)).toEqual(['char:1', 'char:2'])
    expect(links).toContainEqual({ source: 'anime:10', target: 'char:1', kind: 'char' })
  })
  it('azonos vaId → seiyuu-keresztél egyszer', () => {
    const { links } = buildCharacterLayer(favs, new Set([10, 20, 30]))
    const seiyuu = links.filter((l) => l.kind === 'seiyuu')
    expect(seiyuu).toEqual([{ source: 'char:1', target: 'char:2', kind: 'seiyuu' }])
  })
  it('vaId nélkül nincs keresztél', () => {
    const { links } = buildCharacterLayer([{ ...favs[0], vaId: null }], new Set([10]))
    expect(links.filter((l) => l.kind === 'seiyuu')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: FAIL, majd implementáció** — `graph-builder.ts`: `GraphNode.type: 'dim' | 'anime' | 'char'`; `GraphLink.kind` unionba `'char' | 'seiyuu'`;

```ts
export type FavChar = {
  charId: number
  name: string
  image: string | null
  vaId: number | null
  vaName: string | null
  animeId: number
}

// kedvenc karakterek a látható anime-node-jaikhoz kötve + same-seiyuu keresztélek
export function buildCharacterLayer(favs: FavChar[], visibleAnimeIds: Set<number>): { nodes: GraphNode[]; links: GraphLink[] } {
  const visible = favs.filter((f) => visibleAnimeIds.has(f.animeId))
  const nodes: GraphNode[] = visible.map((f) => ({
    id: `char:${f.charId}`,
    type: 'char',
    label: f.name,
    img: f.image ?? undefined,
    val: 3,
  }))
  const links: GraphLink[] = visible.map((f) => ({
    source: `anime:${f.animeId}`, target: `char:${f.charId}`, kind: 'char' as const,
  }))
  const byVa = new Map<number, FavChar[]>()
  for (const f of visible) {
    if (f.vaId == null) continue
    const list = byVa.get(f.vaId) ?? []
    list.push(f)
    byVa.set(f.vaId, list)
  }
  for (const group of byVa.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [lo, hi] = group[i].charId < group[j].charId
          ? [group[i].charId, group[j].charId] : [group[j].charId, group[i].charId]
        links.push({ source: `char:${lo}`, target: `char:${hi}`, kind: 'seiyuu' })
      }
    }
  }
  return { nodes, links }
}
```

PASS: `npx vitest run src/lib/graph-builder.test.ts`.

- [ ] **Step 3: Favorites-API + gráf-wiring** — új `src/app/api/characters/favorites/route.ts`: GET → a user összes kedvence. `graf/page.tsx`: „Karakterek" toggle-pill (localStorage: `anime-graph-chars`, default ki); bekapcsolva fetch + `buildCharacterLayer` a MEGJELENÍTETT anime-node-ok id-halmazával, a node/link-tömbökhöz konkatenálva. `Graph3D.tsx`: `type === 'char'` node → kis kör-sprite a karakterképpel (a meglévő anime-sprite útvonal fél mérettel; képcache-t újrahasznosítsd), `kind === 'seiyuu'` link → szaggatott halvány (a vibe-él stílusa), `kind === 'char'` link → vékony fehér. Hover-tooltipben: név + `CV: vaName` (a vaName-t a node `label`-je mellé a graf-page adja át — bővítsd a GraphNode-ot `sub?: string` mezővel és töltsd `vaName`-mel).

- [ ] **Step 4: Dev-check + teszt + commit** — toggle be: karakterek megjelennek, seiyuu-él látszik két közös hangú kedvencnél.

```bash
npx vitest run
git add -A && git commit -m "feat: favorite-character graph layer with same-seiyuu cross links"
```

---

### Task 11: Vibe preset-chipek + vertikális eredmények

**Files:**
- Create: `src/lib/vibe-presets.ts`
- Test: `src/lib/vibe-presets.test.ts`
- Modify: `src/app/vibe/page.tsx`

**Interfaces:**
- Produces: `VIBE_PRESETS: { group: string; chips: { id: string; label: string; prompt: string }[] }[]` (Hangulat/Műfaj/Hossz/Korszak/Tempó a spec szerint); `buildVibePrompt(selectedIds: string[], custom: string): string` — a kiválasztott chipek prompt-darabjai + custom összefűzve; üres kiválasztás+üres custom → üres string (a küldés-gomb disabled).
- Consumes: meglévő `POST /api/vibe` (prompt stringet vár — NEM változik), `MediaCard`.

- [ ] **Step 1: Failing tesztek** — `src/lib/vibe-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { VIBE_PRESETS, buildVibePrompt } from './vibe-presets'

describe('buildVibePrompt', () => {
  it('chipek prompt-darabjai vesszővel fűződnek + custom a végére', () => {
    const out = buildVibePrompt(['mood-dark', 'len-movie'], 'legyen benne zongora')
    expect(out).toContain('sötét')
    expect(out).toContain('film')
    expect(out.endsWith('legyen benne zongora')).toBe(true)
  })
  it('üres bemenet: üres string', () => {
    expect(buildVibePrompt([], '  ')).toBe('')
  })
  it('ismeretlen chip-id kimarad', () => {
    expect(buildVibePrompt(['nincs-ilyen'], '')).toBe('')
  })
  it('minden preset-id egyedi', () => {
    const ids = VIBE_PRESETS.flatMap((g) => g.chips.map((c) => c.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: FAIL, majd implementáció** — `src/lib/vibe-presets.ts`:

```ts
export type VibeChip = { id: string; label: string; prompt: string }

export const VIBE_PRESETS: { group: string; chips: VibeChip[] }[] = [
  { group: 'Hangulat', chips: [
    { id: 'mood-happy', label: 'Vidám', prompt: 'vidám, feel-good hangulat' },
    { id: 'mood-dark', label: 'Sötét', prompt: 'sötét, komor hangulat' },
    { id: 'mood-sad', label: 'Megható', prompt: 'megható, érzelmes történet' },
    { id: 'mood-tense', label: 'Feszült', prompt: 'feszült, izgalmas' },
    { id: 'mood-cozy', label: 'Kikapcsoló', prompt: 'könnyed, kikapcsoló' },
  ]},
  { group: 'Műfaj', chips: [
    { id: 'g-action', label: 'Action', prompt: 'akció' },
    { id: 'g-romance', label: 'Romance', prompt: 'romantikus' },
    { id: 'g-comedy', label: 'Comedy', prompt: 'vígjáték' },
    { id: 'g-drama', label: 'Drama', prompt: 'dráma' },
    { id: 'g-fantasy', label: 'Fantasy', prompt: 'fantasy' },
    { id: 'g-scifi', label: 'Sci-Fi', prompt: 'sci-fi' },
    { id: 'g-sol', label: 'Slice of Life', prompt: 'slice of life' },
    { id: 'g-thriller', label: 'Thriller', prompt: 'thriller' },
  ]},
  { group: 'Hossz', chips: [
    { id: 'len-movie', label: 'Film', prompt: 'egyestés film' },
    { id: 'len-short', label: 'Rövid (≤13)', prompt: 'rövid, legfeljebb 13 részes sorozat' },
    { id: 'len-normal', label: 'Normál', prompt: 'normál hosszú sorozat' },
    { id: 'len-long', label: 'Hosszú (50+)', prompt: 'hosszú, 50+ részes sorozat' },
  ]},
  { group: 'Korszak', chips: [
    { id: 'era-classic', label: 'Klasszikus', prompt: '2000 előtti klasszikus' },
    { id: 'era-2000s', label: '2000-es évek', prompt: '2000-es évekbeli' },
    { id: 'era-2010s', label: '2010-es évek', prompt: '2010-es évekbeli' },
    { id: 'era-fresh', label: 'Friss (2020+)', prompt: 'friss, 2020 utáni' },
  ]},
  { group: 'Tempó', chips: [
    { id: 'pace-slow', label: 'Lassú-hangulatos', prompt: 'lassú tempójú, hangulatos' },
    { id: 'pace-fast', label: 'Pörgős', prompt: 'pörgős, gyors tempójú' },
  ]},
]

const BY_ID = new Map(VIBE_PRESETS.flatMap((g) => g.chips).map((c) => [c.id, c]))

export function buildVibePrompt(selectedIds: string[], custom: string): string {
  const parts = selectedIds.map((id) => BY_ID.get(id)?.prompt).filter((p): p is string => !!p)
  const c = custom.trim()
  if (c) parts.push(c)
  return parts.join(', ')
}
```

PASS: `npx vitest run src/lib/vibe-presets.test.ts`.

- [ ] **Step 3: Vibe-oldal átépítés** — `vibe/page.tsx`: a szabadszöveg-mező HELYETT felül chip-csoportok (csoport-cím label-mono, chipek toggle-pill, kiválasztva `bg-white/10`), alattuk EGY kis custom-input („Egyéb kívánság — ha valami kimaradt"), Küldés-gomb disabled, ha `buildVibePrompt(...) === ''`. A meglévő +gombos anime-picker és a POST /api/vibe hívás marad (prompt = `buildVibePrompt(selected, custom)`). Eredmény-render: „Új felfedezés" szekció MediaCard-griddel (AniList-enrichment adja a covert/műfajt — description-t az enrichment search-query-jébe fel kell venni; nézd meg a `/api/vibe` enrichment-lekérdezését és bővítsd `description` mezővel), utána „Hasonlók a listádból" kisebb MediaCard-grid.

- [ ] **Step 4: Dev-check + teszt + commit** — chipes keresés end-to-end fut (GLM-kulcs él lokálisan).

```bash
npx vitest run
git add -A && git commit -m "feat: vibe presets with chips and vertical MediaCard results"
```

---

### Task 12: Belső VS

**Files:**
- Modify: `src/app/api/compare/route.ts`
- Modify: `src/app/vs/page.tsx`

**Interfaces:**
- Produces: `POST /api/compare` body `{ username }` (AniList, mostani) VAGY `{ internalUsername }` → a regisztrált user listája DB-ből; ismeretlen belső név → 404 `{ error: 'Nincs ilyen felhasználó' }`; saját magaddal → 400.
- Consumes: `compareLists` (változatlan), `users` + `anime` táblák.

- [ ] **Step 1: API-bővítés** — `api/compare/route.ts`: ha `body.internalUsername` jött:

```ts
const uname = String(body?.internalUsername ?? '').trim()
// users-lookup
const [other] = await db.select().from(users).where(eq(users.username, uname))
if (!other) return NextResponse.json({ error: 'Nincs ilyen felhasználó' }, { status: 404 })
if (other.id === userId) return NextResponse.json({ error: 'Saját magaddal nem megy' }, { status: 400 })
const otherRows = await db.select().from(anime)
  .where(and(eq(anime.userId, other.id), eq(anime.mediaType, 'ANIME')))
const theirs: TheirEntry[] = otherRows.map((r) => ({
  anilistId: r.anilistId, title: r.titleRomaji, coverUrl: r.coverUrl, score: r.myScore,
}))
```

— innen a meglévő `compareLists(mine, theirs)` útvonal fut (a `mine` lekérdezés is `mediaType='ANIME'` szűrőt kap mindkét módban — a VS anime-only marad). Vélemény/taste-adat NEM kerül a válaszba (a compare eleve nem tartalmaz ilyet — ne is adj hozzá).

- [ ] **Step 2: VS-oldal mód-fülek** — `vs/page.tsx`: két fül a form felett („AniList user" | „Belső user", glass-pill toggle), a submit ennek megfelelő body-kulccsal POST-ol; hibaüzenetek megjelenítése (404/400) a meglévő error-state mintával. Eredmény-render változatlan.

- [ ] **Step 3: Dev-check + teszt + commit** — belső móddal a 2. teszt-user (ha nincs, regisztrálj egyet dev-ben az INVITE_CODE=teszt-kod-dal) összehasonlítható; ismeretlen név hibát ad.

```bash
npx vitest run
git add -A && git commit -m "feat: internal user comparison mode on VS page"
```

---

### Task 13: Export-bővítés + teljes regresszió + memória

**Files:**
- Modify: `src/app/api/export/route.ts` (favoriteCharacters a JSON-exportba)
- Modify: `README.md` (új oldalak/feature-ök egy-egy sora, ha a README feature-listás)

**Interfaces:**
- Consumes: minden korábbi task kimenete.

- [ ] **Step 1: Export** — az export-bundle kap `favoriteCharacters` kulcsot (a user összes kedvence).

- [ ] **Step 2: Teljes regresszió**

```bash
npx vitest run && npm run lint && npm run build
```

Elvárt: minden teszt zöld, lint tiszta, build zöld. Ha a build `.next`-lock miatt timeoutol: node-processek kill + `.next` törlés, újra.

- [ ] **Step 3: Kézi smoke dev-ben** — végigkattintás: News (vertikális kártyák), Böngésző (szűrés+Random), preview-oldal, manga hozzáadás + gráf-toggle, karakter-szívezés + gráf-réteg, Vibe chipek, VS belső mód, Stats (elo-blokk nincs), nav (Duel/Szezon nincs).

- [ ] **Step 4: Commit + memória-frissítés**

```bash
git add -A && git commit -m "feat: export favorite characters; docs touch-ups"
```

Memória: `project_anime_graph.md` frissítése az új állapottal (batch kész, mi maradt).
