# Social + AI Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Barát-feed, duo-ajánló, közös watchlist, web push, NL-keresés, ízlés-evolúció, szezon-AI, rendező-gráfréteg, /wrapped oldal, streaming-ikonok — a 2026-07-19-es social+AI spec teljes megvalósítása.

**Architecture:** Minden logika pure fn a `src/lib/`-ben vitest-tel, vékony route-ok fölötte (meglévő minta). 4 additív új tábla. Housemates-modell: minden belső user látja a többit. GLM-hívás mindig `consumeAiQuota` mögött, cache a `recommendations` táblában.

**Tech Stack:** Next.js 15.5 App Router, TypeScript, Drizzle + Neon (`@neondatabase/serverless`), vitest, zod v4, framer-motion, GLM `glm-4.7-flash` (`src/lib/glm.ts`), web-push (ÚJ dep).

## Global Constraints

- Repo: `C:\Users\konig\OneDrive\Dokumentumok\GitHub\anime-graph`, branch `master`.
- UI-szövegek magyarul; stílus a meglévő `glass` / `label-mono` / `btn-ghost` / `btn-solid` osztályokkal.
- Tesztek DB/hálózat NÉLKÜL futnak (`npm run test` = vitest run). Teszt a lib-fájl mellett: `src/lib/<név>.test.ts`.
- `db:push` a drizzle-kit-tel; a drizzle-kit NEM olvassa a `.env.local`-t → PowerShell: `$env:DATABASE_URL="postgres://..."; npm run db:push`.
- AI-hívás előtt mindig `await consumeAiQuota(userId)` (`src/lib/ai-quota.ts`).
- Auth minden route-ban: `const userId = await requireUserId(); if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })`.
- DB-s GET route-okba: `export const dynamic = 'force-dynamic'`.
- Nav-fül NEM bővül (TopNav változatlan).
- Commit minden task végén; üzenet `feat:`/`fix:` prefixszel, angolul.
- `npm run dev` és `npm run build` EGYSZERRE nem futhat (közös `.next`).

---

### Task 1: Schema — 4 új tábla + push

**Files:**
- Modify: `src/db/schema.ts` (fájl vége, a `recommendations` tábla után)

**Interfaces:**
- Produces: `watchlistItems`, `pushSubscriptions`, `notifiedAiring`, `animeStaff` drizzle-táblák — minden későbbi task ezeket importálja `@/db/schema`-ból.

- [ ] **Step 1: Táblák hozzáadása a schema végére** (a `export type AnimeSelect` sorok ELÉ):

```ts
// egy globális közös "együtt nézzük" lista az instance-nek (housemates-modell)
export const watchlistItems = pgTable('watchlist_items', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull().unique(),
  mediaType: text('media_type').notNull().default('ANIME'),
  title: text('title').notNull(),
  coverUrl: text('cover_url'),
  addedBy: integer('added_by').notNull(),
  watchedEpisodes: integer('watched_episodes').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// push-dedup: egy (anime, epizód) párra egyszer megy ki értesítés
export const notifiedAiring = pgTable('notified_airing', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull(),
  episode: integer('episode').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('notified_airing_unique').on(t.anilistId, t.episode),
])

export const animeStaff = pgTable('anime_staff', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().default(1),
  animeId: integer('anime_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  staffId: integer('staff_id').notNull(), // AniList staff id
  name: text('name').notNull(),
  image: text('image'),
  role: text('role').notNull(), // elsőre csak 'Director'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('anime_staff_unique').on(t.userId, t.animeId, t.staffId),
])
```

- [ ] **Step 2: Típus-ellenőrzés**

Run: `npx tsc --noEmit`
Expected: 0 hiba.

- [ ] **Step 3: db:push a dev DB-re** (PowerShell, DATABASE_URL a `.env.local`-ból kézzel):

```powershell
$env:DATABASE_URL="<.env.local-ból>"; npm run db:push
```

Expected: 4 új tábla létrejön, meglévő táblákhoz NEM nyúl. Ha drift-et jelezne meglévő táblán → STOP, ne hagyd jóvá, jelezz.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: schema for watchlist, push subscriptions, airing dedup, staff"
```

---

### Task 2: Feed lib + /api/feed

**Files:**
- Create: `src/lib/feed.ts`
- Test: `src/lib/feed.test.ts`
- Create: `src/app/api/feed/route.ts`

**Interfaces:**
- Produces: `FeedItem` típus és `buildFeed(input: FeedInput, excludeUserId: number, limit?: number): FeedItem[]`; `GET /api/feed` → `{ items: FeedItem[] }`. Task 3 ezt fogyasztja.

- [ ] **Step 1: Failing tesztek** — `src/lib/feed.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildFeed, type FeedInput } from './feed'

const base: FeedInput = { added: [], opinions: [], episodes: [], favChars: [] }

describe('buildFeed', () => {
  it('kiszűri a saját eseményeket és időrendbe rendez', () => {
    const items = buildFeed({
      ...base,
      added: [
        { userId: 1, username: 'en', animeId: 10, anilistId: 100, title: 'A', mediaType: 'ANIME', status: 'planned', at: '2026-07-10T10:00:00Z' },
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', status: 'watching', at: '2026-07-12T10:00:00Z' },
        { userId: 3, username: 'p', animeId: 12, anilistId: 102, title: 'C', mediaType: 'MANGA', status: 'completed', at: '2026-07-11T10:00:00Z' },
      ],
    }, 1)
    expect(items.map((i) => i.title)).toEqual(['B', 'C'])
    expect(items[0].kind).toBe('added')
  })

  it('napi szinten összevonja egy user egy animéjének epizódjait', () => {
    const items = buildFeed({
      ...base,
      episodes: [
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', episode: 3, at: '2026-07-12T10:00:00Z' },
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', episode: 4, at: '2026-07-12T11:00:00Z' },
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', episode: 5, at: '2026-07-13T09:00:00Z' },
      ],
    }, 1)
    expect(items).toHaveLength(2)
    expect(items[0].count).toBe(1) // 07-13
    expect(items[1].count).toBe(2) // 07-12 összevonva
    expect(items[1].detail).toBe('EP 4') // legutolsó epizód a napon
  })

  it('vélemény-kivonatot vág 120 karakterre', () => {
    const long = 'x'.repeat(200)
    const items = buildFeed({
      ...base,
      opinions: [{ userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', text: long, at: '2026-07-12T10:00:00Z' }],
    }, 1)
    expect(items[0].kind).toBe('opinion')
    expect(items[0].detail!.length).toBeLessThanOrEqual(121) // 120 + ellipszis
  })

  it('limitál', () => {
    const added = Array.from({ length: 40 }, (_, i) => ({
      userId: 2, username: 'o', animeId: i, anilistId: i, title: `T${i}`,
      mediaType: 'ANIME', status: 'planned', at: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    }))
    expect(buildFeed({ ...base, added }, 1, 30)).toHaveLength(30)
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/feed.test.ts`
Expected: FAIL (`Cannot find module './feed'`).

- [ ] **Step 3: Implementáció** — `src/lib/feed.ts`:

```ts
export type FeedItem = {
  kind: 'added' | 'opinion' | 'episodes' | 'favchar'
  userId: number
  username: string
  animeId: number | null
  anilistId: number | null
  title: string
  detail: string | null
  count: number
  mediaType: string
  status: string | null
  at: string
}

type Common = { userId: number; username: string; animeId: number; anilistId: number; title: string; mediaType: string; at: string }

export type FeedInput = {
  added: (Common & { status: string })[]
  opinions: (Common & { text: string })[]
  episodes: (Common & { episode: number })[]
  favChars: (Common & { charName: string })[]
}

const excerpt = (t: string) => (t.length > 120 ? `${t.slice(0, 120)}…` : t)

export function buildFeed(input: FeedInput, excludeUserId: number, limit = 30): FeedItem[] {
  const items: FeedItem[] = []
  for (const a of input.added) {
    items.push({ kind: 'added', userId: a.userId, username: a.username, animeId: a.animeId, anilistId: a.anilistId, title: a.title, detail: null, count: 1, mediaType: a.mediaType, status: a.status, at: a.at })
  }
  for (const o of input.opinions) {
    items.push({ kind: 'opinion', userId: o.userId, username: o.username, animeId: o.animeId, anilistId: o.anilistId, title: o.title, detail: excerpt(o.text), count: 1, mediaType: o.mediaType, status: null, at: o.at })
  }
  // epizódok: (user, anime, nap) szerint összevonva, a nap utolsó epizódja a detail
  const byDay = new Map<string, { rows: (Common & { episode: number })[]; latest: string }>()
  for (const e of input.episodes) {
    const key = `${e.userId}|${e.animeId}|${e.at.slice(0, 10)}`
    const g = byDay.get(key) ?? { rows: [], latest: e.at }
    g.rows.push(e)
    if (e.at > g.latest) g.latest = e.at
    byDay.set(key, g)
  }
  for (const g of byDay.values()) {
    const last = [...g.rows].sort((a, b) => b.episode - a.episode)[0]
    items.push({ kind: 'episodes', userId: last.userId, username: last.username, animeId: last.animeId, anilistId: last.anilistId, title: last.title, detail: `EP ${last.episode}`, count: g.rows.length, mediaType: last.mediaType, status: null, at: g.latest })
  }
  for (const f of input.favChars) {
    items.push({ kind: 'favchar', userId: f.userId, username: f.username, animeId: f.animeId, anilistId: f.anilistId, title: f.title, detail: f.charName, count: 1, mediaType: f.mediaType, status: null, at: f.at })
  }
  return items
    .filter((i) => i.userId !== excludeUserId)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit)
}
```

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/feed.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Route** — `src/app/api/feed/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, episodeLog, favoriteCharacters, opinions, users } from '@/db/schema'
import { buildFeed } from '@/lib/feed'
import { requireUserId } from '@/lib/session'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [added, ops, eps, favs] = await Promise.all([
    db.select({
      userId: anime.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      status: anime.status, at: anime.createdAt,
    }).from(anime).innerJoin(users, eq(users.id, anime.userId))
      .orderBy(desc(anime.createdAt)).limit(60),
    db.select({
      userId: anime.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      text: opinions.rawText, at: opinions.updatedAt,
    }).from(opinions).innerJoin(anime, eq(anime.id, opinions.animeId))
      .innerJoin(users, eq(users.id, anime.userId))
      .orderBy(desc(opinions.updatedAt)).limit(60),
    db.select({
      userId: episodeLog.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      episode: episodeLog.episode, at: episodeLog.watchedAt,
    }).from(episodeLog).innerJoin(anime, eq(anime.id, episodeLog.animeId))
      .innerJoin(users, eq(users.id, episodeLog.userId))
      .orderBy(desc(episodeLog.watchedAt)).limit(200),
    db.select({
      userId: favoriteCharacters.userId, username: users.username, animeId: anime.id,
      anilistId: anime.anilistId, title: anime.titleRomaji, mediaType: anime.mediaType,
      charName: favoriteCharacters.name, at: favoriteCharacters.createdAt,
    }).from(favoriteCharacters).innerJoin(anime, eq(anime.id, favoriteCharacters.animeId))
      .innerJoin(users, eq(users.id, favoriteCharacters.userId))
      .orderBy(desc(favoriteCharacters.createdAt)).limit(60),
  ])

  const iso = (d: Date) => d.toISOString()
  const items = buildFeed({
    added: added.map((r) => ({ ...r, at: iso(r.at) })),
    opinions: ops.map((r) => ({ ...r, at: iso(r.at) })),
    episodes: eps.map((r) => ({ ...r, at: iso(r.at) })),
    favChars: favs.map((r) => ({ ...r, at: iso(r.at) })),
  }, userId)
  return NextResponse.json({ items })
}
```

- [ ] **Step 6: tsc + teljes teszt**

Run: `npx tsc --noEmit; npm run test`
Expected: 0 hiba, minden teszt PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/feed.ts src/lib/feed.test.ts src/app/api/feed/route.ts
git commit -m "feat: derived activity feed lib and API"
```

---

### Task 3: News „Társaság" szekció

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/feed` → `{ items: FeedItem[] }` (Task 2), `FeedItem` a `@/lib/feed`-ből.

- [ ] **Step 1: State + fetch** — a `page.tsx` tetején a többi import mellé `import type { FeedItem } from '@/lib/feed'`; a komponensben a `digest` state mellé:

```ts
const [feed, setFeed] = useState<FeedItem[]>([])
```

és a useEffect-be (a digest-fetch mintájára, hiba lenyelve):

```ts
fetch('/api/feed')
  .then((r) => r.json())
  .then((j) => setFeed(j.items ?? []))
  .catch(() => { /* feed nélkül is él az oldal */ })
```

- [ ] **Step 2: Szekció-render** — a digest-blokk UTÁN, az „Amit követsz" szekció ELÉ:

```tsx
{feed.length > 0 && (
  <section>
    <p className="label-mono mb-3">Társaság</p>
    <div className="glass rounded-3xl p-4 flex flex-col gap-2.5">
      {feed.slice(0, 12).map((f, i) => (
        <div key={`${f.kind}-${f.userId}-${f.animeId}-${f.at}`} className="flex items-center gap-3 text-sm">
          <span className="w-7 h-7 shrink-0 rounded-full bg-white/8 grid place-items-center font-mono text-[11px] uppercase text-text-1">
            {f.username.slice(0, 2)}
          </span>
          <p className="min-w-0 flex-1 text-text-2 truncate">
            <span className="text-text-1 font-medium">{f.username}</span>{' '}
            {f.kind === 'added' && <>hozzáadta: </>}
            {f.kind === 'opinion' && <>véleményt írt: </>}
            {f.kind === 'episodes' && <>{f.mediaType === 'MANGA' ? 'olvasott' : 'nézett'} ({f.count > 1 ? `${f.count} rész` : f.detail}): </>}
            {f.kind === 'favchar' && <>kedvence lett: {f.detail} — </>}
            <Link href={`/anime/preview/${f.anilistId}`} className="text-text-1 hover:underline">{f.title}</Link>
            {f.kind === 'opinion' && f.detail && <span className="text-text-3"> — „{f.detail}”</span>}
          </p>
          <span className="label-mono shrink-0">{new Date(f.at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}</span>
        </div>
      ))}
    </div>
  </section>
)}
```

Megjegyzés: a cím mindig `/anime/preview/[anilistId]`-re megy — az previewről a saját listás példányra átirányít, ha megvan (meglévő preview-viselkedés).

- [ ] **Step 3: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build`
Expected: 0 hiba, build zöld.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: friends activity section on News"
```

---

### Task 4: Közös watchlist — API + News-blokk + Közösbe-gombok

**Files:**
- Create: `src/app/api/watchlist/route.ts`
- Modify: `src/app/page.tsx` (News „Társaság" alá blokk)
- Modify: `src/app/anime/[id]/page.tsx` (részletoldal „Közösbe" gomb)

**Interfaces:**
- Consumes: `watchlistItems` tábla (Task 1).
- Produces: `GET /api/watchlist` → `{ items: WatchItem[], usernames: Record<number,string> }`; `POST { anilistId, title, coverUrl?, mediaType? }`; `PATCH { id, delta }` (watchedEpisodes += delta); `DELETE { id }`. `WatchItem` = watchlist_items sor JSON-ban.

- [ ] **Step 1: Route** — `src/app/api/watchlist/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, watchlistItems } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { desc, eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [items, us] = await Promise.all([
    db.select().from(watchlistItems).orderBy(desc(watchlistItems.createdAt)),
    db.select({ id: users.id, username: users.username }).from(users),
  ])
  return NextResponse.json({ items, usernames: Object.fromEntries(us.map((u) => [u.id, u.username])) })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const anilistId = Number(body?.anilistId)
  const title = String(body?.title ?? '').trim()
  if (!Number.isInteger(anilistId) || anilistId <= 0 || !title) {
    return NextResponse.json({ error: 'anilistId és title kötelező' }, { status: 400 })
  }
  const [row] = await db.insert(watchlistItems)
    .values({
      anilistId, title,
      coverUrl: body?.coverUrl ?? null,
      mediaType: body?.mediaType === 'MANGA' ? 'MANGA' : 'ANIME',
      addedBy: userId,
    })
    .onConflictDoNothing({ target: watchlistItems.anilistId })
    .returning()
  return NextResponse.json({ item: row ?? null }, { status: row ? 201 : 200 })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const id = Number(body?.id)
  const delta = Number(body?.delta)
  if (!Number.isInteger(id) || ![1, -1].includes(delta)) {
    return NextResponse.json({ error: 'id és delta (±1) kötelező' }, { status: 400 })
  }
  const [row] = await db.update(watchlistItems)
    .set({ watchedEpisodes: sql`greatest(${watchlistItems.watchedEpisodes} + ${delta}, 0)` })
    .where(eq(watchlistItems.id, id))
    .returning()
  return NextResponse.json({ item: row ?? null })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const id = Number(body?.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id kötelező' }, { status: 400 })
  await db.delete(watchlistItems).where(eq(watchlistItems.id, id))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: News-blokk** — `src/app/page.tsx`, a „Társaság" szekción BELÜL, a feed-lista után. State a komponens tetejére:

```ts
type WatchItem = { id: number; anilistId: number; mediaType: string; title: string; coverUrl: string | null; addedBy: number; watchedEpisodes: number }
const [watchlist, setWatchlist] = useState<WatchItem[]>([])
const [wlUsers, setWlUsers] = useState<Record<number, string>>({})
```

useEffect-be:

```ts
fetch('/api/watchlist')
  .then((r) => r.json())
  .then((j) => { setWatchlist(j.items ?? []); setWlUsers(j.usernames ?? {}) })
  .catch(() => { /* watchlist nélkül is él az oldal */ })
```

Handler + render (a „Társaság" section záró `</section>` elé):

```tsx
{watchlist.length > 0 && (
  <div className="mt-4">
    <p className="label-mono mb-2">Közös lista</p>
    <ul className="flex flex-col gap-2">
      {watchlist.map((w) => (
        <li key={w.id} className="glass rounded-2xl p-2.5 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {w.coverUrl && <img src={w.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
          <div className="min-w-0 flex-1">
            <Link href={`/anime/preview/${w.anilistId}`} className="text-sm font-medium text-text-1 truncate block hover:underline">{w.title}</Link>
            <p className="label-mono">{wlUsers[w.addedBy] ?? '?'} tette fel · együtt: {w.watchedEpisodes} rész</p>
          </div>
          <button
            onClick={async () => {
              const res = await fetch('/api/watchlist', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, delta: 1 }) })
              if (res.ok) setWatchlist((l) => l.map((x) => (x.id === w.id ? { ...x, watchedEpisodes: x.watchedEpisodes + 1 } : x)))
            }}
            className="btn-ghost border border-white/10 px-2 py-0.5 text-xs" title="Együtt megnéztünk egy részt"
          >+1</button>
          <button
            onClick={async () => {
              const res = await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) })
              if (res.ok) setWatchlist((l) => l.filter((x) => x.id !== w.id))
            }}
            className="btn-ghost px-2 py-0.5 text-xs text-text-3" title="Levétel"
          >✕</button>
        </li>
      ))}
    </ul>
  </div>
)}
```

A „Társaság" szekció megjelenési feltételét bővítsd: `{(feed.length > 0 || watchlist.length > 0) && (`.

- [ ] **Step 3: „Közösbe" gomb a részletoldalon** — `src/app/anime/[id]/page.tsx`: keresd meg az akciógomb-sort (státusz-gombok környéke), és tegyél mellé egy gombot (a meglévő gombok stílusában, a pontos beszúrási helyet a fájl olvasása után döntsd el):

```tsx
<button
  onClick={async () => {
    await fetch('/api/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: anime.anilistId, title: anime.titleRomaji, coverUrl: anime.coverUrl, mediaType: anime.mediaType }),
    })
    setSharedAdded(true)
  }}
  disabled={sharedAdded}
  className="btn-ghost border border-white/10 px-3 py-1.5 text-xs disabled:text-[color:var(--status-watching)]"
>
  {sharedAdded ? '✓ Közösben' : '+ Közösbe'}
</button>
```

hozzá state: `const [sharedAdded, setSharedAdded] = useState(false)`.

Ugyanezt a gombot tedd a preview-oldalra is (`src/app/anime/preview/[anilistId]/page.tsx`, a `PreviewAddButtons` mellé, az ottani AniList-adatból töltve) — így a Böngésző/News kártyákról (amik preview-ra linkelnek) is elérhető a Közösbe-tétel.

- [ ] **Step 4: Ellenőrzés + smoke**

Run: `npx tsc --noEmit; npm run build`
Expected: zöld. `npm run dev`-vel: News-on látszik a Közös lista (ha üres, nem), részletoldalon a gomb hozzáad.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/watchlist/route.ts src/app/page.tsx "src/app/anime/[id]/page.tsx"
git commit -m "feat: shared watchlist API and UI"
```

---

### Task 5: Duo-ajánló lib + API

**Files:**
- Create: `src/lib/duo.ts`
- Test: `src/lib/duo.test.ts`
- Create: `src/app/api/recommend/duo/route.ts`

**Interfaces:**
- Consumes: `RecCandidate` (`@/lib/anilist`), `picksSchema`/`parsePicks` minta (`@/lib/recommend`), `glmChat`+`extractJson`, `consumeAiQuota`, `fetchRecommendationsFor(anilistId)`.
- Produces: `buildDuoCandidates`, `buildDuoMessages`, `parseDuoPicks`; `POST /api/recommend/duo { otherUserId }` → `{ picks: { anilistId, title, coverUrl, reason }[], cached: boolean, otherUsername: string }`. Task 6 fogyasztja.

- [ ] **Step 1: Failing tesztek** — `src/lib/duo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildDuoCandidates, buildDuoMessages, parseDuoPicks } from './duo'
import type { RecCandidate } from './anilist'

const c = (id: number, title = `T${id}`): RecCandidate =>
  ({ anilistId: id, title, coverUrl: null, genres: ['Action'], avgScore: 80 })

describe('buildDuoCandidates', () => {
  it('közös planned előre, kizártak kiszűrve, dedup, cap', () => {
    const out = buildDuoCandidates({
      myPlanned: [c(1), c(2), c(3)],
      theirPlanned: [c(2), c(4)],
      recPool: [c(5), c(2), c(6), c(1)],
      excludeIds: new Set([6]),
    })
    expect(out[0].anilistId).toBe(2) // mindkettőnk plannedje
    const ids = out.map((x) => x.anilistId)
    expect(ids).not.toContain(6)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('25-re capel', () => {
    const out = buildDuoCandidates({
      myPlanned: Array.from({ length: 30 }, (_, i) => c(i + 1)),
      theirPlanned: [], recPool: Array.from({ length: 30 }, (_, i) => c(i + 100)),
      excludeIds: new Set(),
    })
    expect(out.length).toBeLessThanOrEqual(25)
  })
})

describe('buildDuoMessages', () => {
  it('mindkét user tényeit és nevét tartalmazza', () => {
    const msgs = buildDuoMessages([c(1)], ['szeretem a mechát'], ['utálom a fillert'], 'en', 'o')
    const user = msgs[1].content
    expect(user).toContain('szeretem a mechát')
    expect(user).toContain('utálom a fillert')
    expect(user).toContain('en')
    expect(user).toContain('o')
  })
})

describe('parseDuoPicks', () => {
  it('parseol és id-t validál', () => {
    const raw = '{"picks":[{"anilistId":1,"reason":"mindkettőtöknek jó lesz"}]}'
    expect(parseDuoPicks(raw)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/duo.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implementáció** — `src/lib/duo.ts`:

```ts
import type { ChatMessage } from './glm'
import type { RecCandidate } from './anilist'
import { parsePicks, type RecPick } from './recommend'

export type DuoPool = {
  myPlanned: RecCandidate[]
  theirPlanned: RecCandidate[]
  recPool: RecCandidate[]
  excludeIds: Set<number>
}

// sorrend: mindkettőnk planned → az egyikünk planned → AniList-rec pool; dedup + cap 25
export function buildDuoCandidates(pool: DuoPool): RecCandidate[] {
  const theirIds = new Set(pool.theirPlanned.map((c) => c.anilistId))
  const both = pool.myPlanned.filter((c) => theirIds.has(c.anilistId))
  const ordered = [...both, ...pool.myPlanned, ...pool.theirPlanned, ...pool.recPool]
  const seen = new Set<number>()
  const out: RecCandidate[] = []
  for (const c of ordered) {
    if (pool.excludeIds.has(c.anilistId) || seen.has(c.anilistId)) continue
    seen.add(c.anilistId)
    out.push(c)
    if (out.length >= 25) break
  }
  return out
}

const SYSTEM = `Közös anime-est tanácsadó vagy. KÉT felhasználó ízlés-memóriája alapján
kiválasztod a jelöltlistából az 5 animét, ami MINDKETTŐJÜKNEK élmény lenne. Minden
választáshoz rövid magyar indoklást írsz, ami MINDKÉT fél ízlésére kitér
("neked azért..., neki azért...").
Válaszolj KIZÁRÓLAG JSON-nal: {"picks":[{"anilistId":szám,"reason":"indoklás"}]}
Pontosan 5 pick, csak a jelöltlistában szereplő anilistId-kkel.`

export function buildDuoMessages(
  candidates: RecCandidate[],
  myFacts: string[],
  theirFacts: string[],
  myName: string,
  theirName: string,
): ChatMessage[] {
  const candLines = candidates.map((c) =>
    `[${c.anilistId}] ${c.title} — műfaj: ${c.genres.join(', ')}; AniList-átlag: ${c.avgScore ?? '?'}`,
  ).join('\n')
  const facts = (fs: string[]) => (fs.length ? fs.map((f) => `- ${f}`).join('\n') : '- (üres)')
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `${myName} ízlése:\n${facts(myFacts)}\n\n${theirName} ízlése:\n${facts(theirFacts)}\n\nJelöltlista:\n${candLines}`,
    },
  ]
}

export function parseDuoPicks(raw: string): RecPick[] {
  return parsePicks(raw)
}
```

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/duo.test.ts`
Expected: PASS.

- [ ] **Step 5: Route** — `src/app/api/recommend/duo/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory, users } from '@/db/schema'
import { fetchRecommendationsFor, type RecCandidate } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildDuoCandidates, buildDuoMessages, parseDuoPicks } from '@/lib/duo'
import { glmChat } from '@/lib/glm'
import { requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
const TTL_MS = 24 * 3600 * 1000

const toCand = (r: { anilistId: number; titleRomaji: string; coverUrl: string | null; genres: string[]; avgScore: number | null }): RecCandidate =>
  ({ anilistId: r.anilistId, title: r.titleRomaji, coverUrl: r.coverUrl, genres: r.genres, avgScore: r.avgScore })

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const otherUserId = Number(body?.otherUserId)
  if (!Number.isInteger(otherUserId) || otherUserId === userId) {
    return NextResponse.json({ error: 'otherUserId kötelező' }, { status: 400 })
  }
  const [other] = await db.select().from(users).where(eq(users.id, otherUserId))
  if (!other) return NextResponse.json({ error: 'Nincs ilyen user' }, { status: 404 })

  const kind = `duo:${Math.min(userId, otherUserId)}:${Math.max(userId, otherUserId)}`
  const cachedRows = await db.select().from(recommendations)
    .where(eq(recommendations.kind, kind))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  const cached = cachedRows[0]
  if (cached && Date.now() - cached.createdAt.getTime() < TTL_MS && body?.force !== true) {
    return NextResponse.json({ ...(cached.result as object), cached: true, otherUsername: other.username })
  }

  const [mine, theirs, myFactRows, theirFactRows] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(anime).where(eq(anime.userId, otherUserId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, otherUserId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
  ])
  const watchedStatuses = new Set(['watching', 'completed', 'dropped'])
  const excludeIds = new Set([
    ...mine.filter((r) => watchedStatuses.has(r.status)).map((r) => r.anilistId),
    ...theirs.filter((r) => watchedStatuses.has(r.status)).map((r) => r.anilistId),
  ])
  // közös kedvencek (mindkettő >= 8) AniList-recjei
  const theirScores = new Map(theirs.map((r) => [r.anilistId, r.myScore]))
  const sharedFavs = mine.filter((r) => (r.myScore ?? 0) >= 8 && (theirScores.get(r.anilistId) ?? 0) >= 8).slice(0, 5)
  const recPools = await Promise.all(sharedFavs.map((f) => fetchRecommendationsFor(f.anilistId).catch(() => [])))

  const candidates = buildDuoCandidates({
    myPlanned: mine.filter((r) => r.status === 'planned').map(toCand),
    theirPlanned: theirs.filter((r) => r.status === 'planned').map(toCand),
    recPool: recPools.flat(),
    excludeIds,
  })
  if (!candidates.length) return NextResponse.json({ error: 'Nincs közös jelölt — adjatok hozzá terveket' }, { status: 400 })

  await consumeAiQuota(userId)
  const messages = buildDuoMessages(
    candidates,
    myFactRows.map((f) => f.text),
    theirFactRows.map((f) => f.text),
    'a kérdező', other.username,
  )
  const picks = parseDuoPicks(await glmChat(messages))
  const byId = new Map(candidates.map((c) => [c.anilistId, c]))
  const result = {
    picks: picks
      .filter((p) => byId.has(p.anilistId))
      .map((p) => ({ ...p, title: byId.get(p.anilistId)!.title, coverUrl: byId.get(p.anilistId)!.coverUrl })),
  }
  await db.insert(recommendations).values({ userId, kind, input: { otherUserId }, result })
  return NextResponse.json({ ...result, cached: false, otherUsername: other.username })
}
```

- [ ] **Step 6: tsc + teljes teszt**

Run: `npx tsc --noEmit; npm run test`
Expected: zöld.

- [ ] **Step 7: Commit**

```bash
git add src/lib/duo.ts src/lib/duo.test.ts src/app/api/recommend/duo/route.ts
git commit -m "feat: duo recommendation lib and API"
```

---

### Task 6: VS oldal — „Mit nézzünk ketten?" UI

**Files:**
- Modify: `src/app/vs/page.tsx`

**Interfaces:**
- Consumes: `POST /api/recommend/duo { otherUserId }` (Task 5). FIGYELEM: a compare API-nak username-je van, a duo-nak userId kell → a `/api/compare` internal válaszát bővíteni kell `otherUserId`-val.

- [ ] **Step 1: compare route bővítés** — `src/app/api/compare/route.ts`: az internal ágban a válaszba tedd bele a másik user id-ját is (`otherUserId: otherUser.id` — a pontos változónevet a fájlból). A response így `{ ...CompareResult, username, otherUserId? }`.

- [ ] **Step 2: VS UI** — `src/app/vs/page.tsx`. A `Result` típus bővítése:

```ts
type Result = CompareResult & { username: string; otherUserId?: number }
```

Új state-ek:

```ts
type DuoPick = { anilistId: number; title: string; coverUrl: string | null; reason: string }
const [duo, setDuo] = useState<DuoPick[] | null>(null)
const [duoLoading, setDuoLoading] = useState(false)
const [duoError, setDuoError] = useState('')
```

Handler:

```ts
async function runDuo() {
  if (!result?.otherUserId) return
  setDuoLoading(true); setDuoError(''); setDuo(null)
  const res = await fetch('/api/recommend/duo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otherUserId: result.otherUserId }),
  })
  const json = await res.json()
  setDuoLoading(false)
  if (!res.ok) { setDuoError(json.error ?? 'Hiba történt'); return }
  setDuo(json.picks ?? [])
}
```

Render — a stat-kártyák (grid-cols-3) UTÁN, csak internal módban:

```tsx
{mode === 'internal' && result.otherUserId != null && (
  <section>
    <div className="flex items-center justify-between mb-2">
      <p className="label-mono">Mit nézzünk ketten?</p>
      <button onClick={runDuo} disabled={duoLoading} className="btn-solid px-4 py-2 text-sm">
        {duoLoading ? 'AI gondolkodik…' : duo ? 'Újra' : 'AI-ajánlás közös estére'}
      </button>
    </div>
    {duoError && <p className="text-sm text-[color:var(--status-dropped)]">{duoError}</p>}
    {duo && (
      <ul className="flex flex-col gap-2">
        {duo.map((p) => (
          <li key={p.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.coverUrl && <img src={p.coverUrl} alt="" className="w-10 rounded-lg" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-xs text-text-2">{p.reason}</p>
            </div>
            <button
              onClick={() => addToPlanned(p.anilistId)}
              disabled={added.has(p.anilistId)}
              className="btn-ghost border border-white/10 px-2.5 py-1 text-xs shrink-0 disabled:text-[color:var(--status-watching)] disabled:border-transparent"
            >
              {added.has(p.anilistId) ? '✓' : '+ Terv'}
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
)}
```

A `run()` elején nullázd: `setDuo(null); setDuoError('')`.

- [ ] **Step 3: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build`
Expected: zöld. Dev-smoke: internal VS után gomb látszik, AI-ajánlás jön (2 user kell a dev DB-ben).

- [ ] **Step 4: Commit**

```bash
git add src/app/vs/page.tsx src/app/api/compare/route.ts
git commit -m "feat: duo recommend button on VS page"
```

---

### Task 7: Web push infra — sw.js, subscribe API, Beállítások-gomb

**Files:**
- Create: `public/sw.js`
- Create: `src/app/api/push/route.ts`
- Create: `src/components/PushToggle.tsx`
- Modify: `src/app/beallitasok/page.tsx` (PushToggle beillesztés)
- Modify: `.env.example` (VAPID-kulcsok)

**Interfaces:**
- Consumes: `pushSubscriptions` tábla (Task 1).
- Produces: `POST /api/push` `{ endpoint, keys: { p256dh, auth } }` (upsert), `DELETE /api/push` `{ endpoint }`; env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Task 8 a táblát olvassa.

- [ ] **Step 1: Dep + kulcsok**

```bash
npm i web-push && npm i -D @types/web-push
npx web-push generate-vapid-keys
```

A generált kulcsokat írd a `.env.local`-ba, és a `.env.example`-be kommentekkel:

```
# web push (npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

- [ ] **Step 2: Service worker** — `public/sw.js`:

```js
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(self.registration.showNotification(data.title || 'Anime Graph', {
    body: data.body || '',
    icon: '/icon.svg',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then((tabs) => {
    const url = e.notification.data && e.notification.data.url ? e.notification.data.url : '/'
    for (const t of tabs) { if ('focus' in t) return t.focus() }
    return clients.openWindow(url)
  }))
})
```

(Ha nincs `public/icon.svg`, nézd meg mi van a `public/`-ban és arra hivatkozz; ha semmi, hagyd el az `icon` mezőt.)

- [ ] **Step 3: Middleware-ellenőrzés** — `src/middleware.ts` (23 sor): győződj meg róla, hogy a `/sw.js` kérés NEM esik auth-redirect alá (a matcher jellemzően kihagyja a fájl-kiterjesztéses utakat — ha nem, vedd fel a public prefixek közé).

- [ ] **Step 4: Subscribe API** — `src/app/api/push/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { pushSubscriptions } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const endpoint = String(body?.endpoint ?? '')
  const p256dh = String(body?.keys?.p256dh ?? '')
  const auth = String(body?.keys?.auth ?? '')
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'hiányos subscription' }, { status: 400 })
  await db.insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh, auth } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const endpoint = String(body?.endpoint ?? '')
  if (!endpoint) return NextResponse.json({ error: 'endpoint kötelező' }, { status: 400 })
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: PushToggle komponens** — `src/components/PushToggle.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

function b64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export default function PushToggle() {
  const [state, setState] = useState<'unsupported' | 'off' | 'on' | 'busy'>('busy')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return }
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('unsupported'))
  }, [])

  async function toggle() {
    const prev = state
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: existing.endpoint }) })
        await existing.unsubscribe()
        setState('off')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error('mentés sikertelen')
      setState('on')
    } catch {
      setState(prev === 'busy' ? 'off' : prev)
    }
  }

  if (state === 'unsupported') return <p className="text-xs text-text-3">Ez a böngésző nem támogatja a web pusht.</p>
  return (
    <button onClick={toggle} disabled={state === 'busy'} className="btn-ghost border border-white/10 px-4 py-2 text-sm">
      {state === 'on' ? '🔔 Push bekapcsolva — kikapcsol' : state === 'busy' ? '…' : '🔕 Push-értesítés bekapcsolása'}
    </button>
  )
}
```

- [ ] **Step 6: Beállítások-oldalra** — `src/app/beallitasok/page.tsx`: olvasd el a fájlt, és a meglévő szekció-minta szerint tegyél be egy „Értesítések" blokkot:

```tsx
<section className="glass rounded-3xl p-5">
  <p className="label-mono mb-2">Értesítések</p>
  <p className="text-sm text-text-2 mb-3">Push, amikor egy követett animéd új része adásba kerül.</p>
  <PushToggle />
</section>
```

import: `import PushToggle from '@/components/PushToggle'`.

- [ ] **Step 7: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build`
Expected: zöld. Dev-smoke: Beállításokon a gomb engedélyt kér, bekapcsol (localhost-on a push engedélyezett).

- [ ] **Step 8: Commit**

```bash
git add public/sw.js src/app/api/push/route.ts src/components/PushToggle.tsx src/app/beallitasok/page.tsx .env.example package.json package-lock.json
git commit -m "feat: web push subscription infra"
```

---

### Task 8: airing-check átalakítás — multi-user push + óránkénti GH Actions

**Files:**
- Create: `src/lib/push.ts`
- Test: `src/lib/push.test.ts`
- Modify: `src/app/api/cron/airing-check/route.ts` (teljes átírás)
- Modify: `vercel.json`
- Create: `.github/workflows/airing-cron.yml`

**Interfaces:**
- Consumes: `pushSubscriptions`, `notifiedAiring` (Task 1), `fetchAiringFor` (`@/lib/anilist`), `web-push` (Task 7).
- Produces: `pickUpcoming(airing, nowSec, windowMin): AiringInfo[]`, `buildAiringPayload(title, episode): { title, body, url }`.

- [ ] **Step 1: Failing tesztek** — `src/lib/push.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildAiringPayload, pickUpcoming } from './push'

describe('pickUpcoming', () => {
  it('csak a következő ablakban adásba kerülőket adja', () => {
    const now = 1_000_000
    const airing = [
      { anilistId: 1, airingAt: now + 60 * 60, nextEpisode: 5 },     // 60 perc múlva → benne
      { anilistId: 2, airingAt: now + 3 * 3600, nextEpisode: 2 },    // 3 óra múlva → nem
      { anilistId: 3, airingAt: now - 600, nextEpisode: 8 },          // már lement → nem
    ]
    expect(pickUpcoming(airing, now, 70).map((a) => a.anilistId)).toEqual([1])
  })
})

describe('buildAiringPayload', () => {
  it('magyar szöveget és url-t épít', () => {
    const p = buildAiringPayload('Frieren', 12)
    expect(p.title).toContain('Frieren')
    expect(p.body).toContain('12')
    expect(p.url).toBe('/')
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/push.test.ts`
Expected: FAIL.

- [ ] **Step 3: Lib** — `src/lib/push.ts`:

```ts
import type { AiringInfo } from './anilist'

export function pickUpcoming(airing: AiringInfo[], nowSec: number, windowMin: number): AiringInfo[] {
  return airing.filter((a) => a.airingAt > nowSec && a.airingAt <= nowSec + windowMin * 60)
}

export function buildAiringPayload(title: string, episode: number): { title: string; body: string; url: string } {
  return {
    title: `${title} — hamarosan adásban`,
    body: `EP ${episode} a következő órában érkezik 🎬`,
    url: '/',
  }
}
```

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/push.test.ts`
Expected: PASS.

- [ ] **Step 5: Route-átírás** — `src/app/api/cron/airing-check/route.ts` teljes cseréje:

```ts
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { db } from '@/db/client'
import { anime, notifiedAiring, pushSubscriptions } from '@/db/schema'
import { fetchAiringFor } from '@/lib/anilist'
import { buildAiringPayload, pickUpcoming } from '@/lib/push'
import { eq, inArray } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// óránkénti hívás (GitHub Actions): push a köv. 70 percben adásba kerülő részekről,
// (anilistId, episode) dedup a notified_airing táblán.
// ?mode=email (napi Vercel-cron): a régi napi e-mail digest az ownernek.
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  const rows = await db.select().from(anime).where(eq(anime.mediaType, 'ANIME'))
  const followed = rows.filter((r) => r.status === 'watching' || r.status === 'planned')
  if (!followed.length) return NextResponse.json({ sent: 0, reason: 'nincs követett anime' })
  const airing = await fetchAiringFor([...new Set(followed.map((r) => r.anilistId))])

  if (req.nextUrl.searchParams.get('mode') === 'email') {
    return NextResponse.json(await sendDailyEmail(followed, airing))
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ skipped: 'VAPID kulcsok nincsenek beállítva' })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const nowSec = Math.floor(Date.now() / 1000)
  const upcoming = pickUpcoming(airing, nowSec, 70)
  if (!upcoming.length) return NextResponse.json({ sent: 0, reason: 'nincs közelgő rész' })

  const subs = await db.select().from(pushSubscriptions)
  const subsByUser = new Map<number, typeof subs>()
  for (const s of subs) {
    const list = subsByUser.get(s.userId) ?? []
    list.push(s)
    subsByUser.set(s.userId, list)
  }

  let sent = 0
  const dead: string[] = []
  for (const a of upcoming) {
    // globális dedup: első futás, ami látja, az értesít mindenkit
    const inserted = await db.insert(notifiedAiring)
      .values({ anilistId: a.anilistId, episode: a.nextEpisode })
      .onConflictDoNothing()
      .returning()
    if (!inserted.length) continue
    const followers = followed.filter((r) => r.anilistId === a.anilistId)
    for (const f of followers) {
      const payload = JSON.stringify(buildAiringPayload(f.titleRomaji, a.nextEpisode))
      for (const s of subsByUser.get(f.userId) ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) dead.push(s.endpoint)
        }
      }
    }
  }
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead))
  return NextResponse.json({ sent, episodes: upcoming.length, removedSubs: dead.length })
}

type FollowedRow = { userId: number; anilistId: number; titleRomaji: string }

// a korábbi napi owner-email logika, változatlan viselkedéssel
async function sendDailyEmail(followed: FollowedRow[], airing: { anilistId: number; airingAt: number; nextEpisode: number }[]) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    return { skipped: 'RESEND_API_KEY / NOTIFY_EMAIL nincs beállítva' }
  }
  const ownerFollowed = followed.filter((r) => r.userId === 1)
  const ownerIds = new Set(ownerFollowed.map((r) => r.anilistId))
  const titleByAnilist = new Map(ownerFollowed.map((r) => [r.anilistId, r.titleRomaji]))
  const nowSec = Math.floor(Date.now() / 1000)
  const today = airing
    .filter((a) => ownerIds.has(a.anilistId) && a.airingAt - nowSec < 24 * 3600 && a.airingAt > nowSec - 3600)
    .sort((a, b) => a.airingAt - b.airingAt)
  if (!today.length) return { sent: false, reason: 'ma nincs új rész' }
  const items = today.map((a) => {
    const time = new Date(a.airingAt * 1000).toLocaleTimeString('hu-HU', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest',
    })
    return `<li style="margin-bottom:6px"><strong>${titleByAnilist.get(a.anilistId)}</strong> — EP ${a.nextEpisode} · ${time}</li>`
  })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'Anime Graph <onboarding@resend.dev>',
      to: process.env.NOTIFY_EMAIL,
      subject: `Ma ${today.length} követett animéd kap új részt`,
      html: `<ul style="padding-left:16px">${items.join('')}</ul>`,
    }),
  })
  return { sent: res.ok, count: today.length }
}
```

FIGYELEM: a régi route email-formázását/feltételeit őrizd meg — a fenti `sendDailyEmail` a jelenlegi route logikájának áthelyezése; ha a meglévő fájl végén eltérés van (pl. from-cím), a MEGLÉVŐT tartsd meg.

- [ ] **Step 6: vercel.json** — a napi cron az email-módra mutasson:

```json
{
  "crons": [
    { "path": "/api/cron/airing-check?mode=email", "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 7: GH Actions workflow** — `.github/workflows/airing-cron.yml`:

```yaml
name: airing-cron
on:
  schedule:
    - cron: '7 * * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping airing-check
        run: |
          curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.APP_URL }}/api/cron/airing-check"
```

(Repo-secretek: `CRON_SECRET`, `APP_URL` — deploy után a user állítja be.)

- [ ] **Step 8: tsc + teljes teszt**

Run: `npx tsc --noEmit; npm run test`
Expected: zöld.

- [ ] **Step 9: Commit**

```bash
git add src/lib/push.ts src/lib/push.test.ts src/app/api/cron/airing-check/route.ts vercel.json .github/workflows/airing-cron.yml
git commit -m "feat: multi-user hourly push notifications for airing episodes"
```

---

### Task 9: Természetes nyelvű keresés (Lista)

**Files:**
- Create: `src/lib/nl-search.ts`
- Test: `src/lib/nl-search.test.ts`
- Create: `src/app/api/search/nl/route.ts`
- Modify: `src/app/lista/page.tsx`

**Interfaces:**
- Produces: `NlItem`, `buildNlMessages(items: NlItem[], query: string): ChatMessage[]`, `parseNlResult(raw: string, validIds: Set<number>): { matchIds: number[]; answer: string }`; `POST /api/search/nl { query }` → `{ matchIds, answer }`.

- [ ] **Step 1: Failing tesztek** — `src/lib/nl-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildNlMessages, parseNlResult, type NlItem } from './nl-search'

const item: NlItem = { id: 1, title: 'Gurren Lagann', genres: ['Mecha'], year: 2007, myScore: 9, status: 'completed', mediaType: 'ANIME', opinion: 'zseniális' }

describe('buildNlMessages', () => {
  it('a listát és a kérdést is tartalmazza', () => {
    const msgs = buildNlMessages([item], 'melyik volt a mecha?')
    expect(msgs[1].content).toContain('Gurren Lagann')
    expect(msgs[1].content).toContain('melyik volt a mecha?')
  })
})

describe('parseNlResult', () => {
  it('parseol és az érvénytelen id-t kiszűri', () => {
    const raw = '{"matchIds":[1,999],"answer":"A Gurren Lagann volt az."}'
    const out = parseNlResult(raw, new Set([1]))
    expect(out.matchIds).toEqual([1])
    expect(out.answer).toContain('Gurren')
  })

  it('rossz JSON-ra dob', () => {
    expect(() => parseNlResult('nincs json', new Set())).toThrow()
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/nl-search.test.ts`
Expected: FAIL.

- [ ] **Step 3: Lib** — `src/lib/nl-search.ts`:

```ts
import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'

export type NlItem = {
  id: number
  title: string
  genres: string[]
  year: number | null
  myScore: number | null
  status: string
  mediaType: string
  opinion: string | null
}

const SYSTEM = `A felhasználó SAJÁT anime/manga-listájában keresel. A kérdésére a listából
válaszolsz: visszaadod a passzoló tételek id-jait és egy rövid magyar választ.
Ha semmi nem passzol, üres matchIds és ezt megmondó answer.
Válaszolj KIZÁRÓLAG JSON-nal: {"matchIds":[szám],"answer":"rövid magyar válasz"}`

export function buildNlMessages(items: NlItem[], query: string): ChatMessage[] {
  const lines = items.map((i) =>
    `[${i.id}] ${i.title} (${i.mediaType === 'MANGA' ? 'manga' : 'anime'}, ${i.year ?? '?'}) — ${i.genres.join('/')}; státusz: ${i.status}; pont: ${i.myScore ?? '-'}${i.opinion ? `; vélemény: ${i.opinion}` : ''}`,
  ).join('\n')
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `A listám:\n${lines}\n\nKérdés: ${query}` },
  ]
}

const nlSchema = z.object({
  matchIds: z.array(z.number().int()).max(50),
  answer: z.string().min(1).max(600),
})

export function parseNlResult(raw: string, validIds: Set<number>): { matchIds: number[]; answer: string } {
  const parsed = nlSchema.parse(extractJson(raw))
  return { matchIds: parsed.matchIds.filter((id) => validIds.has(id)), answer: parsed.answer }
}
```

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/nl-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Route** — `src/app/api/search/nl/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions } from '@/db/schema'
import { consumeAiQuota } from '@/lib/ai-quota'
import { glmChat } from '@/lib/glm'
import { buildNlMessages, parseNlResult, type NlItem } from '@/lib/nl-search'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const query = String(body?.query ?? '').trim()
  if (!query) return NextResponse.json({ error: 'Üres kérdés' }, { status: 400 })

  const rows = await db.select({
    id: anime.id, title: anime.titleRomaji, genres: anime.genres, year: anime.year,
    myScore: anime.myScore, status: anime.status, mediaType: anime.mediaType,
    opinion: opinions.rawText,
  }).from(anime).leftJoin(opinions, eq(opinions.animeId, anime.id))
    .where(eq(anime.userId, userId))
  if (!rows.length) return NextResponse.json({ error: 'Üres a listád' }, { status: 400 })

  const items: NlItem[] = rows.map((r) => ({
    ...r,
    opinion: r.opinion ? (r.opinion.length > 100 ? `${r.opinion.slice(0, 100)}…` : r.opinion) : null,
  }))
  try {
    await consumeAiQuota(userId)
    const raw = await glmChat(buildNlMessages(items, query))
    return NextResponse.json(parseNlResult(raw, new Set(items.map((i) => i.id))))
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
```

- [ ] **Step 6: Lista UI** — `src/app/lista/page.tsx`: olvasd el a fájlt. A meglévő kereső-input mellé „AI"-gomb; state:

```ts
const [aiAnswer, setAiAnswer] = useState<string | null>(null)
const [aiMatches, setAiMatches] = useState<Set<number> | null>(null)
const [aiLoading, setAiLoading] = useState(false)
```

Handler:

```ts
async function runNlSearch() {
  const q = search.trim() // a meglévő kereső-state neve szerint
  if (!q) return
  setAiLoading(true); setAiAnswer(null); setAiMatches(null)
  const res = await fetch('/api/search/nl', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const json = await res.json()
  setAiLoading(false)
  if (!res.ok) { setAiAnswer(json.error ?? 'Hiba történt'); return }
  setAiAnswer(json.answer)
  setAiMatches(new Set(json.matchIds))
}
```

Gomb az input mellett:

```tsx
<button onClick={runNlSearch} disabled={aiLoading} className="btn-ghost border border-white/10 px-3 py-2 text-xs" title="AI-keresés a listádban">
  {aiLoading ? '…' : '✨ AI'}
</button>
```

Válaszbuborék a kereső alatt:

```tsx
{aiAnswer && (
  <p className="glass rounded-2xl px-4 py-3 text-sm text-text-1">
    <span className="label-mono mr-2">✨ AI</span>{aiAnswer}
    <button onClick={() => { setAiAnswer(null); setAiMatches(null) }} className="ml-2 text-text-3 text-xs">✕</button>
  </p>
)}
```

Szűrés: ha `aiMatches != null`, a megjelenített lista CSAK az `aiMatches.has(row.id)` sorok (a meglévő szűrő-lánc elejére fűzve). Így a találatok „elé rendeződnek" — a többi elrejtve, a ✕ visszaállít.

- [ ] **Step 7: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build; npm run test`
Expected: zöld. Dev-smoke: „melyik a mecha?" típusú kérdés válaszol és szűr.

- [ ] **Step 8: Commit**

```bash
git add src/lib/nl-search.ts src/lib/nl-search.test.ts src/app/api/search/nl/route.ts src/app/lista/page.tsx
git commit -m "feat: natural language search over own list"
```

---

### Task 10: Ízlés-evolúció (Stats)

**Files:**
- Create: `src/lib/evolution.ts`
- Test: `src/lib/evolution.test.ts`
- Create: `src/app/api/taste/eras/route.ts`
- Modify: `src/app/stats/page.tsx`
- Modify: `src/app/api/opinion/route.ts` (eras-cache invalidálás)

**Interfaces:**
- Consumes: `tasteMemory`, `recommendations` táblák; `glmChat`, `extractJson`, `consumeAiQuota`.
- Produces: `MonthPoint`, `monthlyEvolution(rows): MonthPoint[]`; `erasSchema`, `buildErasMessages`, `parseEras`; `GET/POST /api/taste/eras`.

- [ ] **Step 1: Failing tesztek** — `src/lib/evolution.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { monthlyEvolution, parseEras } from './evolution'

describe('monthlyEvolution', () => {
  it('havi darabszám + átlagpont, watchedAt előnyben', () => {
    const pts = monthlyEvolution([
      { watchedAt: '2026-01-15T00:00:00Z', createdAt: '2025-12-01T00:00:00Z', myScore: 8 },
      { watchedAt: null, createdAt: '2026-01-20T00:00:00Z', myScore: 6 },
      { watchedAt: '2026-03-05T00:00:00Z', createdAt: '2026-03-01T00:00:00Z', myScore: null },
    ])
    expect(pts).toEqual([
      { month: '2026-01', count: 2, avgScore: 7 },
      { month: '2026-03', count: 1, avgScore: null },
    ])
  })
})

describe('parseEras', () => {
  it('parseol', () => {
    const raw = '{"eras":[{"label":"Mecha-korszak","summary":"Ekkor minden a mecha volt, nagy robotok és dráma.","from":"2025-01","to":"2025-06"},{"label":"Slice-of-life","summary":"Lenyugodott az ízlésed, csendes történetek jöttek.","from":"2025-07","to":"2026-01"}]}'
    expect(parseEras(raw)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/evolution.test.ts`
Expected: FAIL.

- [ ] **Step 3: Lib** — `src/lib/evolution.ts`:

```ts
import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'

export type MonthPoint = { month: string; count: number; avgScore: number | null }

export function monthlyEvolution(
  rows: { watchedAt: string | null; createdAt: string; myScore: number | null }[],
): MonthPoint[] {
  const byMonth = new Map<string, { count: number; scores: number[] }>()
  for (const r of rows) {
    const month = (r.watchedAt ?? r.createdAt).slice(0, 7)
    const g = byMonth.get(month) ?? { count: 0, scores: [] }
    g.count++
    if (r.myScore != null) g.scores.push(r.myScore)
    byMonth.set(month, g)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, g]) => ({
      month, count: g.count,
      avgScore: g.scores.length ? Math.round((g.scores.reduce((s, x) => s + x, 0) / g.scores.length) * 10) / 10 : null,
    }))
}

export const erasSchema = z.object({
  eras: z.array(z.object({
    label: z.string().min(2).max(60),
    summary: z.string().min(10).max(400),
    from: z.string(),
    to: z.string(),
  })).min(2).max(5),
})

export type TasteEra = z.infer<typeof erasSchema>['eras'][number]

const SYSTEM = `A felhasználó időrendbe rakott ízlés-tényeiből 2-5 "ízlés-korszakot" azonosítasz.
Minden korszaknak: rövid magyar címke, 2-3 mondatos magyar összefoglaló, from/to (ÉÉÉÉ-HH).
Válaszolj KIZÁRÓLAG JSON-nal: {"eras":[{"label":"…","summary":"…","from":"ÉÉÉÉ-HH","to":"ÉÉÉÉ-HH"}]}`

export function buildErasMessages(facts: { text: string; at: string }[]): ChatMessage[] {
  const lines = facts.map((f) => `${f.at.slice(0, 7)}: ${f.text}`).join('\n')
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Ízlés-tényeim időrendben:\n${lines}` },
  ]
}

export function parseEras(raw: string): TasteEra[] {
  return erasSchema.parse(extractJson(raw)).eras
}
```

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/evolution.test.ts`
Expected: PASS.

- [ ] **Step 5: Eras route** — `src/app/api/taste/eras/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { recommendations, tasteMemory } from '@/db/schema'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildErasMessages, parseEras } from '@/lib/evolution'
import { glmChat } from '@/lib/glm'
import { requireUserId } from '@/lib/session'
import { and, asc, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const rows = await db.select().from(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, 'taste-eras')))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  return NextResponse.json({ eras: rows[0] ? (rows[0].result as { eras: unknown }).eras : null })
}

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const facts = await db.select().from(tasteMemory)
    .where(eq(tasteMemory.userId, userId))
    .orderBy(asc(tasteMemory.createdAt))
  if (facts.length < 8) return NextResponse.json({ error: 'Még kevés az ízlés-tény (írj véleményeket!)' }, { status: 400 })
  try {
    await consumeAiQuota(userId)
    const eras = parseEras(await glmChat(buildErasMessages(
      facts.map((f) => ({ text: f.text, at: f.createdAt.toISOString() })),
    )))
    await db.delete(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, 'taste-eras')))
    await db.insert(recommendations).values({ userId, kind: 'taste-eras', input: { factCount: facts.length }, result: { eras } })
    return NextResponse.json({ eras })
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
```

- [ ] **Step 6: Invalidálás** — `src/app/api/opinion/route.ts` POST sikeres ága: a `extractStatus: 'done'` update UTÁN:

```ts
await db.delete(recommendations).where(
  and(eq(recommendations.userId, userId), eq(recommendations.kind, 'taste-eras')),
)
```

import-bővítés: `recommendations` a schema-importba.

- [ ] **Step 7: Stats UI** — `src/app/stats/page.tsx`: olvasd el a fájlt, és a meglévő szekció-minta szerint új „Ízlés-evolúció" blokk. A havi adat a meglévő lista-adatból számolható kliens-oldalon (`monthlyEvolution` import a `@/lib/evolution`-ből — a Stats már fetch-eli a teljes listát). Chart: egyszerű CSS-bar sor:

```tsx
{(() => {
  const pts = monthlyEvolution(list.map((a) => ({ watchedAt: a.watchedAt, createdAt: a.createdAt, myScore: a.myScore }))).slice(-18)
  const max = Math.max(...pts.map((p) => p.count), 1)
  return pts.length > 1 && (
    <section className="glass rounded-3xl p-5">
      <p className="label-mono mb-3">Ízlés-evolúció — havi ütem</p>
      <div className="flex items-end gap-1.5 h-28">
        {pts.map((p) => (
          <div key={p.month} className="flex-1 flex flex-col items-center gap-1" title={`${p.month}: ${p.count} cím${p.avgScore != null ? `, átlag ${p.avgScore}` : ''}`}>
            <div className="w-full rounded-t-md bg-white/15" style={{ height: `${(p.count / max) * 100}%` }} />
            {p.avgScore != null && <span className="font-mono text-[9px] text-text-3">{p.avgScore}</span>}
          </div>
        ))}
      </div>
      <ErasBlock />
    </section>
  )
})()}
```

`ErasBlock` ugyanebben a fájlban (vagy a Stats meglévő komponens-bontása szerint):

```tsx
function ErasBlock() {
  const [eras, setEras] = useState<{ label: string; summary: string; from: string; to: string }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/taste/eras').then((r) => r.json()).then((j) => setEras(j.eras ?? null)).catch(() => {})
  }, [])
  async function run() {
    setLoading(true); setError('')
    const res = await fetch('/api/taste/eras', { method: 'POST' })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setEras(json.eras)
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="label-mono">Korszakaim</p>
        <button onClick={run} disabled={loading} className="btn-ghost border border-white/10 px-3 py-1.5 text-xs">
          {loading ? 'AI gondolkodik…' : eras ? 'Frissítés' : 'AI-korszakok'}
        </button>
      </div>
      {error && <p className="text-xs text-[color:var(--status-dropped)] mt-2">{error}</p>}
      {eras && (
        <ol className="mt-3 flex flex-col gap-2">
          {eras.map((e) => (
            <li key={e.label} className="rounded-2xl bg-white/4 p-3">
              <p className="text-sm font-medium">{e.label} <span className="label-mono ml-1">{e.from} → {e.to}</span></p>
              <p className="text-xs text-text-2 mt-1">{e.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build; npm run test`
Expected: zöld.

- [ ] **Step 9: Commit**

```bash
git add src/lib/evolution.ts src/lib/evolution.test.ts src/app/api/taste/eras/route.ts src/app/stats/page.tsx src/app/api/opinion/route.ts
git commit -m "feat: taste evolution chart and AI era summaries on Stats"
```

---

### Task 11: Szezon-preview AI-rangsor (News)

**Files:**
- Modify: `src/lib/seasonal.ts` (nextSeason helper)
- Test: `src/lib/seasonal.test.ts` (bővítés)
- Create: `src/app/api/news/upcoming/route.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `fetchSeason`, `buildSeasonMessages`, `parseSeasonScores` (MÁR LÉTEZNEK a `@/lib/seasonal`-ban — a törölt /szezon oldal gépezete), `genreWeights`+`rankCandidates` (`@/lib/candidates`), `consumeAiQuota`.
- Produces: `nextSeason(now: Date): { season: string; year: number }`; `GET /api/news/upcoming` → `{ season, items: (SeasonMedia & { tasteScore, tasteReason, owned })[] }` (top-8).

- [ ] **Step 1: Failing teszt** — `src/lib/seasonal.test.ts` bővítése:

```ts
import { nextSeason } from './seasonal'

describe('nextSeason', () => {
  it('évhatárt is kezel', () => {
    expect(nextSeason(new Date('2026-07-19'))).toEqual({ season: 'FALL', year: 2026 })
    expect(nextSeason(new Date('2026-11-10'))).toEqual({ season: 'WINTER', year: 2027 })
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/seasonal.test.ts`
Expected: FAIL (`nextSeason is not exported`).

- [ ] **Step 3: Helper** — `src/lib/seasonal.ts`, a `currentSeason` alá:

```ts
const ORDER = ['WINTER', 'SPRING', 'SUMMER', 'FALL']

export function nextSeason(now: Date): { season: string; year: number } {
  const cur = currentSeason(now)
  const i = ORDER.indexOf(cur.season)
  return i === ORDER.length - 1
    ? { season: ORDER[0], year: cur.year + 1 }
    : { season: ORDER[i + 1], year: cur.year }
}
```

- [ ] **Step 4: Teszt zöldre**

Run: `npx vitest run src/lib/seasonal.test.ts`
Expected: PASS.

- [ ] **Step 5: Route** — `src/app/api/news/upcoming/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, recommendations, tasteMemory } from '@/db/schema'
import { fetchSeason } from '@/lib/anilist'
import { consumeAiQuota } from '@/lib/ai-quota'
import { genreWeights, rankCandidates } from '@/lib/candidates'
import { buildSeasonMessages, nextSeason, parseSeasonScores } from '@/lib/seasonal'
import { glmChat } from '@/lib/glm'
import { requireUserId } from '@/lib/session'
import { and, desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
const TTL_MS = 7 * 24 * 3600 * 1000

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const season = nextSeason(new Date())
  const kind = `seasonal-ai:${season.year}-${season.season}`

  const cachedRows = await db.select().from(recommendations)
    .where(and(eq(recommendations.userId, userId), eq(recommendations.kind, kind)))
    .orderBy(desc(recommendations.createdAt)).limit(1)
  const cached = cachedRows[0]
  if (cached && Date.now() - cached.createdAt.getTime() < TTL_MS) {
    return NextResponse.json({ season, items: (cached.result as { items: unknown[] }).items, cached: true })
  }

  const [rows, facts, seasonList] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)).orderBy(desc(tasteMemory.createdAt)).limit(30),
    fetchSeason(season.season, season.year).catch(() => []),
  ])
  if (!seasonList.length) return NextResponse.json({ season, items: [] })

  const owned = new Set(rows.map((r) => r.anilistId))
  const pre = rankCandidates(seasonList, owned, genreWeights(rows), 20)
  try {
    await consumeAiQuota(userId)
    const scores = parseSeasonScores(await glmChat(buildSeasonMessages(pre, facts.map((f) => f.text))))
    const byId = new Map(seasonList.map((s) => [s.anilistId, s]))
    const items = scores
      .sort((a, b) => b.score - a.score).slice(0, 8)
      .filter((s) => byId.has(s.anilistId))
      .map((s) => ({ ...byId.get(s.anilistId)!, tasteScore: s.score, tasteReason: s.reason, owned: owned.has(s.anilistId) }))
    await db.insert(recommendations).values({ userId, kind, input: season, result: { items } })
    return NextResponse.json({ season, items, cached: false })
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 })
  }
}
```

- [ ] **Step 6: News UI** — `src/app/page.tsx`: state + lazy fetch (digest-minta):

```ts
type UpcomingItem = SeasonItem & { tasteScore: number; tasteReason: string }
const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])
const [upcomingSeason, setUpcomingSeason] = useState<{ season: string; year: number } | null>(null)
```

useEffect-be:

```ts
fetch('/api/news/upcoming')
  .then((r) => r.json())
  .then((j) => { setUpcoming(j.items ?? []); setUpcomingSeason(j.season ?? null) })
  .catch(() => { /* enélkül is él az oldal */ })
```

Render — az „A szezon" szekció UTÁN:

```tsx
{upcoming.length > 0 && upcomingSeason && (
  <section>
    <p className="label-mono mb-3">
      Következő szezon — neked · {upcomingSeason.year} {SEASON_LABELS[upcomingSeason.season] ?? upcomingSeason.season}
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {upcoming.map((s) => (
        <MediaCard
          key={s.anilistId}
          title={s.title}
          coverUrl={s.coverUrl}
          genres={s.genres}
          description={s.tasteReason}
          badge={
            <span className="glass rounded-full px-2 py-0.5 font-mono text-sm font-semibold tabular-nums"
              style={{ color: s.tasteScore >= 75 ? 'var(--status-watching)' : 'var(--text-2)' }}>
              {s.tasteScore}
            </span>
          }
          footer={s.owned ? (
            <span className="label-mono text-[color:var(--status-watching)]">listádon</span>
          ) : (
            <button
              onClick={() => addToPlanned(s.anilistId)}
              disabled={added.has(s.anilistId)}
              className="btn-ghost border border-white/10 px-2.5 py-1 text-xs disabled:text-[color:var(--status-watching)] disabled:border-transparent"
            >
              {added.has(s.anilistId) ? '✓' : '+ Tervezem'}
            </button>
          )}
        />
      ))}
    </div>
  </section>
)}
```

(A `description` mezőbe direkt a `tasteReason` megy — a kártya-leírás helyén az indoklás olvasható.)

- [ ] **Step 7: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build; npm run test`
Expected: zöld.

- [ ] **Step 8: Commit**

```bash
git add src/lib/seasonal.ts src/lib/seasonal.test.ts src/app/api/news/upcoming/route.ts src/app/page.tsx
git commit -m "feat: AI-ranked next-season preview on News"
```

---

### Task 12: Staff-adat — AniList fetch, add-hook, backfill

**Files:**
- Modify: `src/lib/anilist.ts` (fetchDirectors)
- Modify: `src/app/api/anime/route.ts` (add-hook)
- Create: `scripts/backfill-staff.mjs`
- Create: `src/app/api/staff/route.ts`

**Interfaces:**
- Consumes: `animeStaff` tábla (Task 1), `anilistFetch`.
- Produces: `StaffEntry = { staffId: number; name: string; image: string | null; role: string }`, `fetchDirectors(anilistId): Promise<StaffEntry[]>`; `GET /api/staff` → `{ staff: { staffId, name, image, animeId }[] }`. Task 13 fogyasztja.

- [ ] **Step 1: fetchDirectors** — `src/lib/anilist.ts` végére:

```ts
export type StaffEntry = { staffId: number; name: string; image: string | null; role: string }

const STAFF_QUERY = `
query ($id: Int!) {
  Media(id: $id) {
    staff(perPage: 12, sort: RELEVANCE) {
      edges { role node { id name { full } image { medium } } }
    }
  }
}`

export async function fetchDirectors(anilistId: number): Promise<StaffEntry[]> {
  type R = { Media: { staff: { edges: { role: string; node: { id: number; name: { full: string }; image: { medium: string | null } | null } }[] } } }
  const data = await anilistFetch<R>(STAFF_QUERY, { id: anilistId })
  return data.Media.staff.edges
    .filter((e) => e.role === 'Director')
    .map((e) => ({ staffId: e.node.id, name: e.node.name.full, image: e.node.image?.medium ?? null, role: e.role }))
}
```

- [ ] **Step 2: Add-hook** — `src/app/api/anime/route.ts` POST, az insert `.returning()` UTÁN, a response ELŐTT (best-effort, hibát lenyel):

```ts
// rendező best-effort mentése — hibája nem akaszthatja meg az add-ot
try {
  const directors = await fetchDirectors(anilistId)
  if (directors.length) {
    await db.insert(animeStaff)
      .values(directors.map((d) => ({ userId, animeId: row.id, staffId: d.staffId, name: d.name, image: d.image, role: d.role })))
      .onConflictDoNothing()
  }
} catch { /* staff nélkül is él a sor */ }
```

importok: `fetchDirectors` az anilist-importba, `animeStaff` a schema-importba.

(Az AniList-import bulk-flow-ba SZÁNDÉKOSAN nincs staff-hook — címenkénti extra AniList-hívás lenne; az importált sorokat a backfill-script fedi le utólagos futtatással.)

- [ ] **Step 3: Staff GET route** — `src/app/api/staff/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { animeStaff } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const staff = await db.select({
    staffId: animeStaff.staffId, name: animeStaff.name,
    image: animeStaff.image, animeId: animeStaff.animeId,
  }).from(animeStaff).where(eq(animeStaff.userId, userId))
  return NextResponse.json({ staff })
}
```

- [ ] **Step 4: Backfill-script** — `scripts/backfill-staff.mjs` (a description-backfill mintája):

```js
// egyszeri backfill: rendezők minden anime-sorhoz, aminek még nincs staffja
// futtatás: node scripts/backfill-staff.mjs  (DATABASE_URL env kell)
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
const rows = await sql`
  SELECT a.id, a.user_id, a.anilist_id FROM anime a
  WHERE NOT EXISTS (SELECT 1 FROM anime_staff s WHERE s.anime_id = a.id)`
console.log(`${rows.length} sor staff nélkül`)

const uniqueIds = [...new Set(rows.map((r) => r.anilist_id))]
const staffByAnilist = new Map()
for (let i = 0; i < uniqueIds.length; i += 50) {
  const batch = uniqueIds.slice(i, i + 50)
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query ($ids: [Int!]) { Page(perPage: 50) { media(id_in: $ids) {
        id staff(perPage: 12, sort: RELEVANCE) { edges { role node { id name { full } image { medium } } } }
      } } }`,
      variables: { ids: batch },
    }),
  })
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  for (const m of json.data.Page.media) {
    staffByAnilist.set(m.id, m.staff.edges
      .filter((e) => e.role === 'Director')
      .map((e) => ({ staffId: e.node.id, name: e.node.name.full, image: e.node.image?.medium ?? null })))
  }
  console.log(`AniList: ${Math.min(i + 50, uniqueIds.length)}/${uniqueIds.length}`)
  await new Promise((r) => setTimeout(r, 700)) // rate limit alatt maradunk
}

let inserted = 0
for (const row of rows) {
  for (const d of staffByAnilist.get(row.anilist_id) ?? []) {
    await sql`INSERT INTO anime_staff (user_id, anime_id, staff_id, name, image, role)
      VALUES (${row.user_id}, ${row.id}, ${d.staffId}, ${d.name}, ${d.image}, 'Director')
      ON CONFLICT DO NOTHING`
    inserted++
  }
}
console.log(`kész — ${inserted} staff-sor`)
```

- [ ] **Step 5: Backfill futtatása a dev DB-re** (PowerShell):

```powershell
$env:DATABASE_URL="<.env.local-ból>"; node scripts/backfill-staff.mjs
```

Expected: lefut, `kész — N staff-sor`.

- [ ] **Step 6: tsc + commit**

Run: `npx tsc --noEmit`
Expected: zöld.

```bash
git add src/lib/anilist.ts src/app/api/anime/route.ts src/app/api/staff/route.ts scripts/backfill-staff.mjs
git commit -m "feat: director staff data - fetch, add-hook, backfill, API"
```

---

### Task 13: Staff gráf-réteg

**Files:**
- Modify: `src/lib/graph-builder.ts` (buildStaffLayer)
- Test: `src/lib/graph-builder.test.ts` (bővítés)
- Modify: `src/app/graf/page.tsx`

**Interfaces:**
- Consumes: `GET /api/staff` (Task 12), `GraphNode`/`GraphLink` típusok.
- Produces: `StaffRow = { staffId: number; name: string; image: string | null; animeId: number }`, `buildStaffLayer(rows: StaffRow[], visibleAnimeIds: Set<number>): { nodes: GraphNode[]; links: GraphLink[] }`.

- [ ] **Step 1: Failing tesztek** — `src/lib/graph-builder.test.ts` bővítése:

```ts
import { buildStaffLayer } from './graph-builder'

describe('buildStaffLayer', () => {
  const rows = [
    { staffId: 100, name: 'Rendező A', image: null, animeId: 1 },
    { staffId: 100, name: 'Rendező A', image: null, animeId: 2 },
    { staffId: 200, name: 'Rendező B', image: null, animeId: 3 },
  ]

  it('egy staff-node több animéhez kötve (a közös node maga a kereszt-kapcsolat)', () => {
    const { nodes, links } = buildStaffLayer(rows, new Set([1, 2, 3]))
    expect(nodes).toHaveLength(2)
    expect(links.filter((l) => l.source === 'anime:1' || l.source === 'anime:2')).toHaveLength(2)
    expect(links.every((l) => l.kind === 'char')).toBe(true)
  })

  it('nem látható animék staffja kimarad, árva node sincs', () => {
    const { nodes, links } = buildStaffLayer(rows, new Set([3]))
    expect(nodes.map((n) => n.id)).toEqual(['staff:200'])
    expect(links).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/graph-builder.test.ts`
Expected: FAIL az új describe-ra.

- [ ] **Step 3: Implementáció** — `src/lib/graph-builder.ts`, a `buildCharacterLayer` alá:

```ts
export type StaffRow = { staffId: number; name: string; image: string | null; animeId: number }

// rendezők a látható animéikhez kötve; ugyanaz a rendező több animénél = közös node,
// ami maga adja a kereszt-kapcsolatot (külön él nem kell)
export function buildStaffLayer(rows: StaffRow[], visibleAnimeIds: Set<number>): { nodes: GraphNode[]; links: GraphLink[] } {
  const visible = rows.filter((r) => visibleAnimeIds.has(r.animeId))
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  for (const r of visible) {
    const id = `staff:${r.staffId}`
    if (!nodes.has(id)) {
      nodes.set(id, { id, type: 'char', label: r.name, sub: 'rendező', img: r.image ?? undefined, val: 3 })
    }
    links.push({ source: `anime:${r.animeId}`, target: id, kind: 'char' })
  }
  return { nodes: [...nodes.values()], links }
}
```

(`type: 'char'` + `kind: 'char'` szándékos — a Graph3D karakter-renderelése változtatás nélkül működik rá; a `sub: 'rendező'` a tooltipben különbözteti meg.)

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/graph-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Graf oldal** — `src/app/graf/page.tsx`: a karakter-réteg (showChars/favChars) mintájára:
- state: `const [showStaff, setShowStaff] = useState(false)` + localStorage-perzisztencia ugyanúgy, ahogy a `showChars` csinálja (olvasd ki a mintát a fájlból — kulcs: `'graf:staff'`);
- fetch: ahol a `favChars`-t tölti, mellé `fetch('/api/staff').then(r => r.json()).then(j => setStaffRows(j.staff ?? []))` és `const [staffRows, setStaffRows] = useState<StaffRow[]>([])`;
- merge: a `useMemo`-ban, ahol a karakter-réteget fűzi a base-hez, ugyanazzal a feltétel-mintával (`!timelineMode`):

```ts
if (showStaff && !timelineMode) {
  const layer = buildStaffLayer(staffRows, new Set(base.nodes.filter((n) => n.animeId != null).map((n) => n.animeId!)))
  merged = { nodes: [...merged.nodes, ...layer.nodes], links: [...merged.links, ...layer.links] }
}
```

(a pontos merge-formát igazítsd a fájl meglévő karakter-merge kódjához);
- toggle-gomb a karakter-toggle mellé: `🎬 Stáb` felirattal, ugyanazzal a gomb-stílussal.
- függőség-lista: `staffRows`, `showStaff` a useMemo deps-be.

- [ ] **Step 6: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build; npm run test`
Expected: zöld. Dev-smoke: Stáb-toggle bekapcsolva rendező-node-ok jelennek meg, közös rendező két animét összeköt.

- [ ] **Step 7: Commit**

```bash
git add src/lib/graph-builder.ts src/lib/graph-builder.test.ts src/app/graf/page.tsx
git commit -m "feat: director staff layer on 3D graph"
```

---

### Task 14: Wrapped teljes oldal

**Files:**
- Create: `src/lib/wrapped.ts`
- Test: `src/lib/wrapped.test.ts`
- Create: `src/app/api/wrapped/route.ts`
- Create: `src/app/wrapped/page.tsx`
- Modify: `src/app/stats/page.tsx` (link)

**Interfaces:**
- Consumes: `anime`, `episodeLog`, `favoriteCharacters` táblák; meglévő `WrappedCard` komponens (`list: ApiAnime[]` prop).
- Produces: `WrappedData`, `buildWrapped(animeRows, episodes, favChars, year): WrappedData`, `availableYears(animeRows, episodes): number[]`; `GET /api/wrapped?year=2026` → `WrappedData & { years: number[] }`.

- [ ] **Step 1: Failing tesztek** — `src/lib/wrapped.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { availableYears, buildWrapped } from './wrapped'

const a = (over: object) => ({
  id: 1, titleRomaji: 'T', coverUrl: null, genres: ['Action'], studio: 'MAPPA',
  myScore: 8, mediaType: 'ANIME', durationMin: 24, chapters: null, progress: 12,
  watchedAt: '2026-02-10T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', ...over,
})

describe('buildWrapped', () => {
  it('órákat az epizód-logból számol, top műfaj/stúdió/anime jön', () => {
    const w = buildWrapped(
      [a({ id: 1 }), a({ id: 2, titleRomaji: 'U', myScore: 9, studio: 'Bones', genres: ['Drama'] })],
      [
        { animeId: 1, watchedAt: '2026-02-01T10:00:00Z' },
        { animeId: 1, watchedAt: '2026-02-02T10:00:00Z' },
        { animeId: 2, watchedAt: '2026-02-02T12:00:00Z' },
      ],
      [{ name: 'K', image: null, createdAt: '2026-03-01T00:00:00Z' }],
      2026,
    )
    expect(w.totalEpisodes).toBe(3)
    expect(w.totalHours).toBeCloseTo(3 * 24 / 60, 5)
    expect(w.topAnime[0].title).toBe('U')
    expect(w.topGenres.map((g) => g.name)).toContain('Action')
    expect(w.favChars).toHaveLength(1)
  })

  it('streak: egymást követő napok', () => {
    const w = buildWrapped([a({})], [
      { animeId: 1, watchedAt: '2026-02-01T10:00:00Z' },
      { animeId: 1, watchedAt: '2026-02-02T10:00:00Z' },
      { animeId: 1, watchedAt: '2026-02-03T10:00:00Z' },
      { animeId: 1, watchedAt: '2026-02-10T10:00:00Z' },
    ], [], 2026)
    expect(w.longestStreakDays).toBe(3)
  })

  it('másik év epizódjai nem számítanak', () => {
    const w = buildWrapped([a({})], [{ animeId: 1, watchedAt: '2025-02-01T10:00:00Z' }], [], 2026)
    expect(w.totalEpisodes).toBe(0)
  })
})

describe('availableYears', () => {
  it('epizód-log + watchedAt évei, csökkenő', () => {
    expect(availableYears(
      [a({ watchedAt: '2024-05-01T00:00:00Z' })],
      [{ animeId: 1, watchedAt: '2026-02-01T10:00:00Z' }],
    )).toEqual([2026, 2024])
  })
})
```

- [ ] **Step 2: Futtatás — bukjon**

Run: `npx vitest run src/lib/wrapped.test.ts`
Expected: FAIL.

- [ ] **Step 3: Lib** — `src/lib/wrapped.ts`:

```ts
export type WrappedAnimeRow = {
  id: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  studio: string | null
  myScore: number | null
  mediaType: string
  durationMin: number | null
  chapters: number | null
  progress: number
  watchedAt: string | null
  createdAt: string
}

export type WrappedEpisode = { animeId: number; watchedAt: string }
export type WrappedFavChar = { name: string; image: string | null; createdAt: string }

export type WrappedData = {
  year: number
  totalEpisodes: number
  totalHours: number
  topGenres: { name: string; count: number }[]
  topStudios: { name: string; count: number }[]
  topAnime: { title: string; coverUrl: string | null; myScore: number | null }[]
  longestStreakDays: number
  favChars: { name: string; image: string | null }[]
  manga: { count: number; chapters: number } | null
}

const yearOf = (iso: string) => Number(iso.slice(0, 4))

function topCounts(values: string[], limit: number): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

export function buildWrapped(
  rows: WrappedAnimeRow[],
  episodes: WrappedEpisode[],
  favChars: WrappedFavChar[],
  year: number,
): WrappedData {
  const eps = episodes.filter((e) => yearOf(e.watchedAt) === year)
  const durByAnime = new Map(rows.map((r) => [r.id, r.durationMin ?? 24]))
  const totalHours = eps.reduce((s, e) => s + (durByAnime.get(e.animeId) ?? 24), 0) / 60

  // az év "aktív" címei: van idei epizód-log VAGY idei watchedAt
  const activeIds = new Set(eps.map((e) => e.animeId))
  const active = rows.filter((r) =>
    activeIds.has(r.id) || (r.watchedAt != null && yearOf(r.watchedAt) === year))
  const activeAnime = active.filter((r) => r.mediaType === 'ANIME')
  const activeManga = active.filter((r) => r.mediaType === 'MANGA')

  // leghosszabb egymást követő napi sorozat
  const days = [...new Set(eps.map((e) => e.watchedAt.slice(0, 10)))].sort()
  let longest = days.length ? 1 : 0
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime()
    const cur = new Date(`${days[i]}T00:00:00Z`).getTime()
    run = cur - prev === 86_400_000 ? run + 1 : 1
    if (run > longest) longest = run
  }

  return {
    year,
    totalEpisodes: eps.length,
    totalHours,
    topGenres: topCounts(active.flatMap((r) => r.genres), 5),
    topStudios: topCounts(activeAnime.map((r) => r.studio).filter((s): s is string => !!s), 5),
    topAnime: [...active].filter((r) => r.myScore != null)
      .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0)).slice(0, 5)
      .map((r) => ({ title: r.titleRomaji, coverUrl: r.coverUrl, myScore: r.myScore })),
    longestStreakDays: longest,
    favChars: favChars.filter((f) => yearOf(f.createdAt) === year).slice(0, 8)
      .map((f) => ({ name: f.name, image: f.image })),
    manga: activeManga.length
      ? { count: activeManga.length, chapters: eps.filter((e) => activeManga.some((m) => m.id === e.animeId)).length }
      : null,
  }
}

export function availableYears(rows: WrappedAnimeRow[], episodes: WrappedEpisode[]): number[] {
  const years = new Set<number>()
  for (const e of episodes) years.add(yearOf(e.watchedAt))
  for (const r of rows) if (r.watchedAt) years.add(yearOf(r.watchedAt))
  return [...years].sort((a, b) => b - a)
}
```

- [ ] **Step 4: Tesztek zöldre**

Run: `npx vitest run src/lib/wrapped.test.ts`
Expected: PASS.

- [ ] **Step 5: Route** — `src/app/api/wrapped/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, episodeLog, favoriteCharacters } from '@/db/schema'
import { availableYears, buildWrapped } from '@/lib/wrapped'
import { requireUserId } from '@/lib/session'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const [rows, eps, favs] = await Promise.all([
    db.select().from(anime).where(eq(anime.userId, userId)),
    db.select().from(episodeLog).where(eq(episodeLog.userId, userId)),
    db.select().from(favoriteCharacters).where(eq(favoriteCharacters.userId, userId)),
  ])
  const mapped = rows.map((r) => ({
    id: r.id, titleRomaji: r.titleRomaji, coverUrl: r.coverUrl, genres: r.genres,
    studio: r.studio, myScore: r.myScore, mediaType: r.mediaType,
    durationMin: r.durationMin, chapters: r.chapters, progress: r.progress,
    watchedAt: r.watchedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
  }))
  const episodes = eps.map((e) => ({ animeId: e.animeId, watchedAt: e.watchedAt.toISOString() }))
  const years = availableYears(mapped, episodes)
  const year = Number(req.nextUrl.searchParams.get('year')) || years[0] || new Date().getFullYear()
  const data = buildWrapped(mapped, episodes,
    favs.map((f) => ({ name: f.name, image: f.image, createdAt: f.createdAt.toISOString() })), year)
  return NextResponse.json({ ...data, years })
}
```

- [ ] **Step 6: Oldal** — `src/app/wrapped/page.tsx` (client, scroll-snap slide-ok, framer-motion `whileInView` belépés; a záró slide-on a meglévő `WrappedCard` — ahhoz a teljes lista kell, fetch `/api/anime`):

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import WrappedCard from '@/components/WrappedCard'
import type { WrappedData } from '@/lib/wrapped'
import type { ApiAnime } from '@/lib/types'

type Data = WrappedData & { years: number[] }

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-screen snap-start grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-3xl px-8 py-10 max-w-lg w-full text-center"
      >
        {children}
      </motion.div>
    </section>
  )
}

export default function WrappedPage() {
  const [data, setData] = useState<Data | null>(null)
  const [list, setList] = useState<ApiAnime[]>([])
  const [error, setError] = useState('')

  async function load(year?: number) {
    const res = await fetch(`/api/wrapped${year ? `?year=${year}` : ''}`)
    if (!res.ok) { setError((await res.json()).error ?? 'Hiba történt'); return }
    setData(await res.json())
  }
  useEffect(() => {
    load()
    fetch('/api/anime').then((r) => r.json()).then((j) => setList(j.anime ?? [])).catch(() => {})
  }, [])

  if (error) return <main className="min-h-screen grid place-items-center"><p className="text-sm text-[color:var(--status-dropped)]">{error}</p></main>
  if (!data) return <main className="min-h-screen grid place-items-center"><p className="label-mono">Összefoglaló készül…</p></main>

  return (
    <main className="h-screen overflow-y-auto snap-y snap-mandatory">
      <Slide>
        <p className="label-mono mb-2">Anime Wrapped</p>
        <h1 className="text-5xl font-semibold tabular-nums">{data.year}</h1>
        <div className="mt-4 flex justify-center gap-2">
          {data.years.map((y) => (
            <button key={y} onClick={() => load(y)}
              className={`btn-ghost px-3 py-1 text-xs border ${y === data.year ? 'border-white/40 text-text-1' : 'border-white/10 text-text-3'}`}>
              {y}
            </button>
          ))}
        </div>
        <p className="text-text-3 text-sm mt-6">Görgess ↓</p>
      </Slide>
      <Slide>
        <p className="label-mono mb-3">Ennyit néztél</p>
        <p className="text-5xl font-semibold tabular-nums">{Math.round(data.totalHours)} óra</p>
        <p className="text-text-2 mt-2">{data.totalEpisodes} rész / fejezet</p>
      </Slide>
      {data.topGenres.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Top műfajaid</p>
          <ol className="flex flex-col gap-2">
            {data.topGenres.map((g, i) => (
              <li key={g.name} className="flex items-baseline justify-between gap-4">
                <span className={i === 0 ? 'text-2xl font-semibold' : 'text-base text-text-2'}>{i + 1}. {g.name}</span>
                <span className="font-mono text-sm text-text-3">{g.count} cím</span>
              </li>
            ))}
          </ol>
        </Slide>
      )}
      {data.topStudios.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Top stúdióid</p>
          <ol className="flex flex-col gap-2">
            {data.topStudios.map((s, i) => (
              <li key={s.name} className="flex items-baseline justify-between gap-4">
                <span className={i === 0 ? 'text-2xl font-semibold' : 'text-base text-text-2'}>{i + 1}. {s.name}</span>
                <span className="font-mono text-sm text-text-3">{s.count} cím</span>
              </li>
            ))}
          </ol>
        </Slide>
      )}
      {data.topAnime.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Az év címei nálad</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {data.topAnime.map((t) => (
              <figure key={t.title} className="w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.coverUrl && <img src={t.coverUrl} alt={t.title} className="rounded-xl w-24 h-32 object-cover" />}
                <figcaption className="text-[11px] text-text-2 mt-1 line-clamp-2">{t.title} · {t.myScore}/10</figcaption>
              </figure>
            ))}
          </div>
        </Slide>
      )}
      {data.longestStreakDays > 1 && (
        <Slide>
          <p className="label-mono mb-3">Leghosszabb sorozatod</p>
          <p className="text-5xl font-semibold tabular-nums">{data.longestStreakDays} nap</p>
          <p className="text-text-2 mt-2">megállás nélkül minden nap</p>
        </Slide>
      )}
      {data.favChars.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Idei kedvenc karaktereid</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {data.favChars.map((c) => (
              <figure key={c.name} className="w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image && <img src={c.image} alt={c.name} className="rounded-full w-16 h-16 object-cover" />}
                <figcaption className="text-[10px] text-text-3 mt-1 truncate">{c.name}</figcaption>
              </figure>
            ))}
          </div>
        </Slide>
      )}
      {data.manga && (
        <Slide>
          <p className="label-mono mb-3">Manga</p>
          <p className="text-4xl font-semibold tabular-nums">{data.manga.count} cím</p>
          <p className="text-text-2 mt-2">{data.manga.chapters} fejezet elolvasva</p>
        </Slide>
      )}
      <Slide>
        <p className="label-mono mb-4">Oszd meg</p>
        {list.length > 0 && <WrappedCard list={list} />}
        <Link href="/stats" className="btn-ghost border border-white/10 px-4 py-2 text-sm mt-6 inline-block">← Vissza a Stats-ra</Link>
      </Slide>
    </main>
  )
}
```

(A `WrappedCard` pontos propjait ellenőrizd a `src/app/stats/page.tsx`-beli használat alapján — jelenleg `<WrappedCard list={list} />`.)

- [ ] **Step 7: Stats-link** — `src/app/stats/page.tsx`: a WrappedCard-blokk mellé/fölé:

```tsx
<Link href="/wrapped" className="btn-solid px-4 py-2 text-sm">✨ Éves Wrapped →</Link>
```

(import `Link` ha még nincs).

- [ ] **Step 8: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build; npm run test`
Expected: zöld. Dev-smoke: /wrapped görgethető slide-ok, év-váltó működik.

- [ ] **Step 9: Commit**

```bash
git add src/lib/wrapped.ts src/lib/wrapped.test.ts src/app/api/wrapped/route.ts src/app/wrapped/page.tsx src/app/stats/page.tsx
git commit -m "feat: full-page yearly Wrapped with scroll slides"
```

---

### Task 15: Streaming-ikonok a kártyákon

**Files:**
- Modify: `src/lib/anilist.ts` (`fetchSeason` + `fetchBrowse` query-k: `externalLinks`)
- Modify: `src/components/MediaCard.tsx` (`streaming` prop)
- Modify: `src/app/page.tsx`, `src/app/bongeszo/page.tsx`, `src/app/vibe/page.tsx` (prop átadás)

**Interfaces:**
- Produces: `StreamLink = { site: string; url: string }`; `SeasonMedia` és `BrowseMedia` bővül `streaming: StreamLink[]` mezővel; `MediaCard` új opcionális prop: `streaming?: StreamLink[]`.

- [ ] **Step 1: AniList-query-k** — `src/lib/anilist.ts`:
- `export type StreamLink = { site: string; url: string }`
- A `fetchSeason` és `fetchBrowse` GraphQL-jébe vedd fel: `externalLinks { site url type }`, a mapping-be:

```ts
streaming: (m.externalLinks ?? [])
  .filter((l: { type: string }) => l.type === 'STREAMING')
  .slice(0, 3)
  .map((l: { site: string; url: string }) => ({ site: l.site, url: l.url })),
```

- A `SeasonMedia` és `BrowseMedia` típusokba: `streaming: StreamLink[]`.
- A vibe-flow: nézd meg, honnan jönnek a vibe-találatok (`src/lib/vibe.ts` / `/api/vibe`) — ha AniList-search-ből, ott is vedd fel ugyanígy; ha nem fér ki természetesen, a vibe-nál hagyd ki és jegyezd fel a task-összefoglalóban.

- [ ] **Step 2: MediaCard** — `src/components/MediaCard.tsx`:

```ts
type StreamLink = { site: string; url: string }
```

Props-ba: `streaming?: StreamLink[]`. Render — a műfaj-sor alá:

```tsx
{streaming && streaming.length > 0 && (
  <div className="flex gap-1 mt-1">
    {streaming.map((s) => (
      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.site}
        className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-2 hover:text-text-1">
        {s.site.slice(0, 4)}
      </a>
    ))}
  </div>
)}
```

- [ ] **Step 3: Hívóhelyek** — News szezon-grid + „Következő szezon" (Task 11 blokk), Böngésző-kártyák, (Vibe ha volt): `streaming={s.streaming}` prop átadás; a kliens-típusokba (`SeasonItem`, browse-item) vedd fel a `streaming` mezőt.

- [ ] **Step 4: Ellenőrzés**

Run: `npx tsc --noEmit; npm run build; npm run test`
Expected: zöld. Dev-smoke: szezon-kártyákon CR/NETF chip, kattintva új fül.

- [ ] **Step 5: Commit**

```bash
git add src/lib/anilist.ts src/components/MediaCard.tsx src/app/page.tsx src/app/bongeszo/page.tsx src/app/vibe/page.tsx
git commit -m "feat: streaming link chips on AniList-sourced media cards"
```

---

### Task 16: Polish sweep + záró verifikáció

**Files:**
- Modify: amit a sweep talál (kis UX-javítások, oldalanként)

- [ ] **Step 1: Sweep** — `npm run dev` mellett Playwrighttal vagy kézzel végigmenni: News (feed+watchlist+upcoming), Gráf (Stáb-toggle, idővonal), Lista (AI-keresés), Böngésző, Vibe, Stats (evolúció, Wrapped-link), VS (duo), részletoldal (Közösbe, streaming), Beállítások (push), /wrapped. Minden talált apró hibát (elcsúszó layout, hiányzó üres-állapot, konzol-warning) azonnal javítani. A talált+javított listát a task-összefoglalóba.

- [ ] **Step 2: Ismert tétel-ellenőrzés** — az `airing-check` már multi-user (Task 8) — ellenőrizd, hogy a Vercel napi cron útvonala `?mode=email`-lel fut, és a GH Actions workflow fájl a repóban van.

- [ ] **Step 3: Teljes verifikáció**

Run: `npx tsc --noEmit; npm run lint; npm run test; npm run build`
Expected: mind zöld (85+ meglévő + ~20 új teszt).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: polish sweep across pages after social/AI batch"
```

---

## Deploy-jegyzet (user-teendő a batch után)

- Prod Neon: `db:push` a prod DATABASE_URL-lel + `node scripts/backfill-staff.mjs` proddal.
- Vercel env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, (meglévők: `CRON_SECRET` stb.).
- GitHub repo-secretek: `CRON_SECRET`, `APP_URL` (a GH Actions cronhoz).
- Push HTTPS-t igényel → élesben (Vercel-domain) működik, localhoston a böngésző kivételez.
