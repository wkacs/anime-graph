# Anime Graph Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working core of the personal anime app: password-protected Next.js app with a hierarchical 3D graph of the user's anime list, per-anime opinions distilled by GLM into a taste memory, and a "Recommend me" button that returns AI-ranked recommendations with reasons.

**Architecture:** Next.js App Router monolith. Neon Postgres via Drizzle stores anime metadata (fetched once from AniList GraphQL), raw opinions, and AI-extracted taste facts. Pure, unit-tested libs (`graph-builder`, `candidates`, `extract`, `glm` JSON parsing) sit under thin API routes. The 3D view is `react-force-graph-3d` (Three.js) rendered client-side only.

**Tech Stack:** Next.js 15 + TypeScript, Drizzle ORM + @neondatabase/serverless, zod, react-force-graph-3d + three + three-spritetext, GLM `glm-4.7-flash` chat API, vitest.

## Global Constraints

- UI copy is Hungarian; code identifiers/comments English.
- Env vars (exact names): `DATABASE_URL`, `GLM_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET`. Never commit real values; `.env.local` is user-managed.
- GLM model is exactly `glm-4.7-flash` (free tier). Endpoint: `https://open.bigmodel.cn/api/paas/v4/chat/completions`.
- AniList GraphQL endpoint: `https://graphql.anilist.co`, no API key, always called server-side.
- Vercel/Neon provisioning is done by the USER, never by the agent (company-account risk). Code only reads env vars. Do not run `vercel` CLI.
- npm scripts must be Windows-safe: no `VAR=x cmd` prefixes, no bash-isms.
- Single user, one password. No multi-user tables.
- All GLM responses validated with zod before use.
- Repo root: `C:\Users\konig\OneDrive\Dokumentumok\GitHub\anime-graph` (git already initialized, spec committed).
- Node 20+. Package manager: npm.
- Unit tests must not require a database or network; test pure functions only.

---

### Task 1: Scaffold Next.js app + tooling

**Files:**
- Create (via create-next-app): `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/globals.css`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `npm run dev|build|test|db:generate|db:push` scripts; `@/*` path alias to `src/*`; installed deps used by all later tasks.

- [ ] **Step 1: Scaffold with create-next-app**

Run in `C:\Users\konig\OneDrive\Dokumentumok\GitHub\anime-graph`:

```
npx create-next-app@15 . --typescript --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Expected: scaffold succeeds (`docs` and `.git` are on create-next-app's allowed-files whitelist). If it refuses because of existing files, move `docs/` out, scaffold, move it back.

- [ ] **Step 2: Install runtime + dev dependencies**

```
npm install drizzle-orm @neondatabase/serverless zod react-force-graph-3d three three-spritetext
npm install -D drizzle-kit vitest @types/three
```

Expected: no peer-dependency errors.

- [ ] **Step 3: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 4: Add npm scripts + env example**

In `package.json` set the `scripts` block to exactly:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push"
}
```

Create `.env.example`:

```
# Neon Postgres connection string (user provisions Neon manually)
DATABASE_URL=
# GLM API key (open.bigmodel.cn) — model: glm-4.7-flash
GLM_API_KEY=
# Login password for the single user
APP_PASSWORD=
# Random long string for signing the session cookie
SESSION_SECRET=
```

Append to `.gitignore` (create-next-app already ignores `.env*`; verify, and if missing add):

```
.env
.env.local
```

- [ ] **Step 5: Verify build and empty test run**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run test`
Expected: "No test files found" exit 0 or vitest passes with 0 tests (vitest exits 1 on no tests by default — acceptable at this step; later tasks add tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with tooling (drizzle, vitest, force-graph deps)"
```

---

### Task 2: Database schema + client

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `drizzle.config.ts`

**Interfaces:**
- Consumes: env `DATABASE_URL`
- Produces: `db` (drizzle instance) and tables `anime`, `opinions`, `tasteMemory`, `settings`, `duels`, `recommendations`. Exact column names below are relied on by every API task. Types exported: `AnimeInsert = typeof anime.$inferInsert`, `AnimeSelect = typeof anime.$inferSelect`.

- [ ] **Step 1: Write the schema**

Create `src/db/schema.ts`:

```ts
import {
  pgTable, serial, integer, text, timestamp, jsonb, real,
} from 'drizzle-orm/pg-core'

export type TagEntry = { name: string; rank: number }
export type RelationEntry = { type: string; anilistId: number; title: string }

export const anime = pgTable('anime', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull().unique(),
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
  relations: jsonb('relations').$type<RelationEntry[]>().notNull().default([]),
  trailerSite: text('trailer_site'),
  trailerId: text('trailer_id'),
  avgScore: integer('avg_score'),
  // user-owned fields
  status: text('status').notNull().default('planned'), // watching | completed | dropped | planned
  progress: integer('progress').notNull().default(0),
  myScore: integer('my_score'),
  elo: real('elo').notNull().default(1200),
  watchedAt: timestamp('watched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const opinions = pgTable('opinions', {
  id: serial('id').primaryKey(),
  animeId: integer('anime_id').notNull().unique()
    .references(() => anime.id, { onDelete: 'cascade' }),
  rawText: text('raw_text').notNull(),
  extractStatus: text('extract_status').notNull().default('pending'), // pending | done | failed
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const tasteMemory = pgTable('taste_memory', {
  id: serial('id').primaryKey(),
  animeId: integer('anime_id')
    .references(() => anime.id, { onDelete: 'cascade' }), // null = global
  kind: text('kind').notNull(), // like | dislike | note
  text: text('text').notNull(),
  source: text('source').notNull(), // opinion | settings | duel
  weight: real('weight').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
})

export const duels = pgTable('duels', {
  id: serial('id').primaryKey(),
  winnerId: integer('winner_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  loserId: integer('loser_id').notNull()
    .references(() => anime.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const recommendations = pgTable('recommendations', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(), // recommend | vibe | seasonal
  input: jsonb('input').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type AnimeSelect = typeof anime.$inferSelect
export type AnimeInsert = typeof anime.$inferInsert
```

- [ ] **Step 2: Write the client**

Create `src/db/client.ts` (note the `no-store` fetch option — Neon HTTP responses got cached on Vercel in a previous project without it):

```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!, {
  fetchOptions: { cache: 'no-store' },
})

export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Drizzle config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exit 0.

Do NOT run `db:push` here — user provisions Neon and runs `npm run db:push` themselves with their `DATABASE_URL` in `.env.local` (drizzle-kit reads `.env.local` automatically? It does NOT — instruct user to run it as `npx dotenv -e .env.local -- npm run db:push` OR simply temporarily set the var; document in README task 13).

- [ ] **Step 5: Commit**

```bash
git add src/db drizzle.config.ts
git commit -m "feat: drizzle schema and neon client (anime, opinions, taste_memory, settings, duels, recommendations)"
```

---

### Task 3: Auth — session lib, middleware, login

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/api/auth/route.ts`

**Interfaces:**
- Consumes: env `APP_PASSWORD`, `SESSION_SECRET`
- Produces: `sessionToken(secret: string): Promise<string>`, `isValidSession(secret: string, token: string | undefined): Promise<boolean>`. Cookie name: `session`. All later pages/APIs are protected by the middleware automatically.

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sessionToken, isValidSession } from './auth'

describe('auth', () => {
  it('produces a stable hex token for a secret', async () => {
    const a = await sessionToken('secret-1')
    const b = await sessionToken('secret-1')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different secrets produce different tokens', async () => {
    expect(await sessionToken('secret-1')).not.toBe(await sessionToken('secret-2'))
  })

  it('validates only the matching token', async () => {
    const t = await sessionToken('s')
    expect(await isValidSession('s', t)).toBe(true)
    expect(await isValidSession('s', t + 'x')).toBe(false)
    expect(await isValidSession('s', undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL — cannot resolve `./auth`.

- [ ] **Step 3: Implement auth lib (Web Crypto — edge-safe)**

Create `src/lib/auth.ts`:

```ts
const enc = new TextEncoder()
const SESSION_PAYLOAD = 'anime-graph-session-v1'

export async function sessionToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(SESSION_PAYLOAD))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function isValidSession(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false
  return (await sessionToken(secret)) === token
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Middleware**

Create `src/middleware.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isValidSession } from '@/lib/auth'

const PUBLIC_PREFIXES = ['/login', '/api/auth']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()
  const ok = await isValidSession(
    process.env.SESSION_SECRET!,
    req.cookies.get('session')?.value,
  )
  if (ok) return NextResponse.next()
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico).*)'],
}
```

- [ ] **Step 6: Auth API route**

Create `src/app/api/auth/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { sessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Hibás jelszó' }, { status: 401 })
  }
  const token = await sessionToken(process.env.SESSION_SECRET!)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return res
}
```

- [ ] **Step 7: Login page**

Create `src/app/login/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) router.push('/')
    else setError('Hibás jelszó')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#04060f] text-slate-200">
      <form onSubmit={submit} className="flex flex-col gap-4 w-72 p-8 rounded-xl bg-slate-900/80 border border-slate-700">
        <h1 className="text-xl font-semibold text-center">Anime Graph</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Jelszó"
          className="rounded-md bg-slate-800 border border-slate-600 px-3 py-2 outline-none focus:border-cyan-400"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2">
          Belépés
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Verify build + manual check**

Run: `npm run build`
Expected: success.

Run `npm run dev` briefly with a `.env.local` containing test values (`APP_PASSWORD=test`, `SESSION_SECRET=devsecret`, `DATABASE_URL` may be blank for this check): opening `http://localhost:3000/` must redirect to `/login`; wrong password shows "Hibás jelszó"; right password lands on `/`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/middleware.ts src/app/login src/app/api/auth
git commit -m "feat: password auth with HMAC session cookie, middleware protection, login page"
```

---

### Task 4: AniList client + search API

**Files:**
- Create: `src/lib/anilist.ts`
- Test: `src/lib/anilist.test.ts`
- Create: `src/app/api/anilist/search/route.ts`

**Interfaces:**
- Consumes: nothing internal
- Produces:
  - `anilistFetch<T>(query: string, variables: Record<string, unknown>): Promise<T>`
  - `searchAnime(q: string): Promise<SearchResult[]>` where `SearchResult = { anilistId: number; titleRomaji: string; titleEnglish: string | null; coverUrl: string | null; year: number | null; format: string | null; genres: string[] }`
  - `fetchMedia(anilistId: number): Promise<AnilistMedia>` (raw)
  - `mapMedia(m: AnilistMedia): AnimeInsert` (pure, tested) — used by Task 5's POST /api/anime
  - `MEDIA_RECS_QUERY` + `fetchRecommendationsFor(anilistId: number)` returning `{ anilistId, title, coverUrl, genres, avgScore }[]` — used by Task 12
  - GET `/api/anilist/search?q=...` → `{ results: SearchResult[] }`

- [ ] **Step 1: Write the failing test for the pure mapper**

Create `src/lib/anilist.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapMedia, type AnilistMedia } from './anilist'

const fixture: AnilistMedia = {
  id: 9253,
  title: { romaji: 'Steins;Gate', english: 'Steins;Gate', native: 'シュタインズ・ゲート' },
  coverImage: { large: 'https://img.example/cover.jpg' },
  bannerImage: 'https://img.example/banner.jpg',
  genres: ['Sci-Fi', 'Thriller'],
  tags: [{ name: 'Time Travel', rank: 95 }, { name: 'Male Protagonist', rank: 60 }],
  studios: { nodes: [{ name: 'White Fox' }] },
  season: 'SPRING',
  seasonYear: 2011,
  episodes: 24,
  duration: 24,
  format: 'TV',
  averageScore: 87,
  trailer: { id: '27OZc-ku6is', site: 'youtube' },
  relations: {
    edges: [
      { relationType: 'SEQUEL', node: { id: 21127, type: 'ANIME', title: { romaji: 'Steins;Gate 0' } } },
      { relationType: 'ADAPTATION', node: { id: 44, type: 'MANGA', title: { romaji: 'ignore me' } } },
    ],
  },
}

describe('mapMedia', () => {
  it('maps AniList media to an anime insert row', () => {
    const row = mapMedia(fixture)
    expect(row.anilistId).toBe(9253)
    expect(row.titleRomaji).toBe('Steins;Gate')
    expect(row.coverUrl).toBe('https://img.example/cover.jpg')
    expect(row.genres).toEqual(['Sci-Fi', 'Thriller'])
    expect(row.studio).toBe('White Fox')
    expect(row.year).toBe(2011)
    expect(row.durationMin).toBe(24)
    expect(row.trailerSite).toBe('youtube')
    expect(row.avgScore).toBe(87)
  })

  it('keeps only ANIME relations', () => {
    const row = mapMedia(fixture)
    expect(row.relations).toEqual([
      { type: 'SEQUEL', anilistId: 21127, title: 'Steins;Gate 0' },
    ])
  })

  it('tolerates missing optional fields', () => {
    const row = mapMedia({
      ...fixture,
      studios: { nodes: [] },
      trailer: null,
      relations: { edges: [] },
      title: { romaji: 'X', english: null, native: null },
    })
    expect(row.studio).toBeNull()
    expect(row.trailerSite).toBeNull()
    expect(row.relations).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/anilist.test.ts`
Expected: FAIL — cannot resolve `./anilist`.

- [ ] **Step 3: Implement the AniList lib**

Create `src/lib/anilist.ts`:

```ts
import type { AnimeInsert } from '@/db/schema'

const API = 'https://graphql.anilist.co'

export type AnilistMedia = {
  id: number
  title: { romaji: string; english: string | null; native: string | null }
  coverImage: { large: string | null } | null
  bannerImage: string | null
  genres: string[]
  tags: { name: string; rank: number }[]
  studios: { nodes: { name: string }[] }
  season: string | null
  seasonYear: number | null
  episodes: number | null
  duration: number | null
  format: string | null
  averageScore: number | null
  trailer: { id: string; site: string } | null
  relations: { edges: { relationType: string; node: { id: number; type: string; title: { romaji: string } } }[] }
}

export type SearchResult = {
  anilistId: number
  titleRomaji: string
  titleEnglish: string | null
  coverUrl: string | null
  year: number | null
  format: string | null
  genres: string[]
}

export async function anilistFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`AniList: ${json.errors[0].message}`)
  return json.data as T
}

const SEARCH_QUERY = `
query ($search: String!) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      title { romaji english }
      coverImage { large }
      seasonYear
      format
      genres
    }
  }
}`

export async function searchAnime(q: string): Promise<SearchResult[]> {
  type R = { Page: { media: { id: number; title: { romaji: string; english: string | null }; coverImage: { large: string | null } | null; seasonYear: number | null; format: string | null; genres: string[] }[] } }
  const data = await anilistFetch<R>(SEARCH_QUERY, { search: q })
  return data.Page.media.map((m) => ({
    anilistId: m.id,
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    coverUrl: m.coverImage?.large ?? null,
    year: m.seasonYear,
    format: m.format,
    genres: m.genres,
  }))
}

const MEDIA_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    coverImage { large }
    bannerImage
    genres
    tags { name rank }
    studios(isMain: true) { nodes { name } }
    season
    seasonYear
    episodes
    duration
    format
    averageScore
    trailer { id site }
    relations { edges { relationType node { id type title { romaji } } } }
  }
}`

export async function fetchMedia(anilistId: number): Promise<AnilistMedia> {
  const data = await anilistFetch<{ Media: AnilistMedia }>(MEDIA_QUERY, { id: anilistId })
  return data.Media
}

export function mapMedia(m: AnilistMedia): AnimeInsert {
  return {
    anilistId: m.id,
    titleRomaji: m.title.romaji,
    titleEnglish: m.title.english,
    titleNative: m.title.native,
    coverUrl: m.coverImage?.large ?? null,
    bannerUrl: m.bannerImage,
    genres: m.genres ?? [],
    tags: (m.tags ?? []).map((t) => ({ name: t.name, rank: t.rank })),
    studio: m.studios.nodes[0]?.name ?? null,
    season: m.season,
    year: m.seasonYear,
    episodes: m.episodes,
    durationMin: m.duration,
    format: m.format,
    relations: m.relations.edges
      .filter((e) => e.node.type === 'ANIME')
      .map((e) => ({ type: e.relationType, anilistId: e.node.id, title: e.node.title.romaji })),
    trailerSite: m.trailer?.site ?? null,
    trailerId: m.trailer?.id ?? null,
    avgScore: m.averageScore,
  }
}

export type RecCandidate = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
}

const MEDIA_RECS_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    recommendations(perPage: 10, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          id
          title { romaji }
          coverImage { large }
          genres
          averageScore
        }
      }
    }
  }
}`

export async function fetchRecommendationsFor(anilistId: number): Promise<RecCandidate[]> {
  type R = { Media: { recommendations: { nodes: { mediaRecommendation: { id: number; title: { romaji: string }; coverImage: { large: string | null } | null; genres: string[]; averageScore: number | null } | null }[] } } }
  const data = await anilistFetch<R>(MEDIA_RECS_QUERY, { id: anilistId })
  return data.Media.recommendations.nodes
    .map((n) => n.mediaRecommendation)
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => ({
      anilistId: m.id,
      title: m.title.romaji,
      coverUrl: m.coverImage?.large ?? null,
      genres: m.genres,
      avgScore: m.averageScore,
    }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/anilist.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Search API route**

Create `src/app/api/anilist/search/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { searchAnime } from '@/lib/anilist'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })
  try {
    return NextResponse.json({ results: await searchAnime(q) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/lib/anilist.ts src/lib/anilist.test.ts src/app/api/anilist
git commit -m "feat: AniList client (search, media, recommendations) with tested mapper"
```

---

### Task 5: Anime CRUD API

**Files:**
- Create: `src/app/api/anime/route.ts`
- Create: `src/app/api/anime/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `anime` (Task 2), `fetchMedia` + `mapMedia` (Task 4)
- Produces:
  - GET `/api/anime` → `{ anime: AnimeSelect[], facts: { id, animeId, kind, text }[] }` (facts joined in so the graph page loads with one request; facts come from `taste_memory`)
  - POST `/api/anime` body `{ anilistId: number }` → `{ anime: AnimeSelect }` (fetches AniList, upserts)
  - PATCH `/api/anime/[id]` body: any subset of `{ status, progress, myScore, watchedAt }` → `{ anime: AnimeSelect }`
  - DELETE `/api/anime/[id]` → `{ ok: true }`

- [ ] **Step 1: List + create route**

Create `src/app/api/anime/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory } from '@/db/schema'
import { fetchMedia, mapMedia } from '@/lib/anilist'
import { eq } from 'drizzle-orm'

export async function GET() {
  const rows = await db.select().from(anime)
  const facts = await db.select({
    id: tasteMemory.id,
    animeId: tasteMemory.animeId,
    kind: tasteMemory.kind,
    text: tasteMemory.text,
  }).from(tasteMemory)
  return NextResponse.json({ anime: rows, facts })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const anilistId = Number(body?.anilistId)
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: 'anilistId kötelező' }, { status: 400 })
  }
  const existing = await db.select().from(anime).where(eq(anime.anilistId, anilistId))
  if (existing.length) return NextResponse.json({ anime: existing[0] })
  const media = await fetchMedia(anilistId)
  const [row] = await db.insert(anime).values(mapMedia(media)).returning()
  return NextResponse.json({ anime: row }, { status: 201 })
}
```

- [ ] **Step 2: Update + delete route**

Create `src/app/api/anime/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime } from '@/db/schema'
import { eq } from 'drizzle-orm'

const STATUSES = ['watching', 'completed', 'dropped', 'planned'] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Érvénytelen státusz' }, { status: 400 })
    }
    patch.status = body.status
    if (body.status === 'completed' && body.watchedAt === undefined) {
      patch.watchedAt = new Date()
    }
  }
  if (body.progress !== undefined) patch.progress = Math.max(0, Number(body.progress) || 0)
  if (body.myScore !== undefined) {
    patch.myScore = body.myScore === null ? null
      : Math.min(10, Math.max(1, Number(body.myScore) || 1))
  }
  if (body.watchedAt !== undefined) {
    patch.watchedAt = body.watchedAt === null ? null : new Date(body.watchedAt)
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Üres módosítás' }, { status: 400 })
  }
  const [row] = await db.update(anime).set(patch).where(eq(anime.id, Number(id))).returning()
  if (!row) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })
  return NextResponse.json({ anime: row })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.delete(anime).where(eq(anime.id, Number(id)))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success. (No unit test — routes are thin wrappers over tested libs; DB-backed routes are covered by the manual smoke in Task 13.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/anime
git commit -m "feat: anime CRUD API (add from AniList, list with taste facts, patch status/score, delete)"
```

---

### Task 6: GLM client with backoff + JSON extraction

**Files:**
- Create: `src/lib/glm.ts`
- Test: `src/lib/glm.test.ts`

**Interfaces:**
- Consumes: env `GLM_API_KEY`
- Produces:
  - `glmChat(messages: { role: 'system' | 'user'; content: string }[], opts?: { retries?: number }): Promise<string>` — returns assistant content, retries 429/5xx with exponential backoff
  - `extractJson(text: string): unknown` (pure, tested) — finds the first balanced `{...}` block anywhere in the text (handles \`\`\`json fences and prose around it) and JSON.parses it; throws if none

- [ ] **Step 1: Write the failing test for extractJson**

Create `src/lib/glm.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractJson } from './glm'

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON inside a fenced code block with prose around', () => {
    const text = 'Íme a válasz:\n```json\n{"facts":[{"kind":"like","text":"jó zene"}]}\n```\nremélem segít'
    expect(extractJson(text)).toEqual({ facts: [{ kind: 'like', text: 'jó zene' }] })
  })

  it('handles nested braces and braces inside strings', () => {
    const text = 'x {"a":{"b":"}"},"c":2} y'
    expect(extractJson(text)).toEqual({ a: { b: '}' }, c: 2 })
  })

  it('throws when no JSON object present', () => {
    expect(() => extractJson('nincs itt semmi')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/glm.test.ts`
Expected: FAIL — cannot resolve `./glm`.

- [ ] **Step 3: Implement**

Create `src/lib/glm.ts`:

```ts
const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const MODEL = 'glm-4.7-flash'

export type ChatMessage = { role: 'system' | 'user'; content: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function glmChat(
  messages: ChatMessage[],
  { retries = 3 }: { retries?: number } = {},
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1))
    try {
      const res = await fetch(GLM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GLM_API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.4 }),
      })
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`GLM HTTP ${res.status}`)
        continue
      }
      if (!res.ok) throw new Error(`GLM HTTP ${res.status}: ${await res.text()}`)
      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content) throw new Error('GLM: üres válasz')
      return content
    } catch (e) {
      lastError = e
      if (e instanceof TypeError) continue // network error → retry
      throw e
    }
  }
  throw lastError instanceof Error ? lastError : new Error('GLM: minden próbálkozás elbukott')
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('Nincs JSON a válaszban')
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error('Lezáratlan JSON a válaszban')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/glm.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/glm.ts src/lib/glm.test.ts
git commit -m "feat: GLM chat client with backoff retry and robust JSON extraction"
```

---

### Task 7: Opinion → taste memory pipeline

**Files:**
- Create: `src/lib/extract.ts`
- Test: `src/lib/extract.test.ts`
- Create: `src/app/api/opinion/route.ts`
- Create: `src/app/api/taste/[id]/route.ts`

**Interfaces:**
- Consumes: `glmChat`, `extractJson` (Task 6); `db`, `opinions`, `tasteMemory` (Task 2)
- Produces:
  - `factsSchema` (zod), `Fact = { kind: 'like' | 'dislike' | 'note'; text: string }`
  - `buildExtractMessages(title: string, opinion: string): ChatMessage[]` (pure)
  - `parseFacts(raw: string): Fact[]` (pure, tested)
  - `extractFacts(title: string, opinion: string): Promise<Fact[]>` — glmChat + parse, one re-ask on parse failure
  - POST `/api/opinion` body `{ animeId, rawText }` → saves raw text, replaces `source='opinion'` facts, returns `{ opinion, facts, extractStatus }`. On GLM failure: opinion saved with `extractStatus:'failed'`, HTTP still 200.
  - POST `/api/opinion/retry` handled via same route: body `{ animeId, retry: true }` re-runs extraction from the stored raw text.
  - GET `/api/opinion?animeId=N` → `{ opinion: { rawText, extractStatus } | null }`
  - DELETE `/api/taste/[id]` → `{ ok: true }` (single fact removal from side panel)

- [ ] **Step 1: Write the failing test**

Create `src/lib/extract.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseFacts, buildExtractMessages } from './extract'

describe('parseFacts', () => {
  it('accepts a valid facts payload', () => {
    const raw = '```json\n{"facts":[{"kind":"like","text":"a time-travel plot végig feszes volt"},{"kind":"dislike","text":"lassú első 6 rész"}]}\n```'
    expect(parseFacts(raw)).toEqual([
      { kind: 'like', text: 'a time-travel plot végig feszes volt' },
      { kind: 'dislike', text: 'lassú első 6 rész' },
    ])
  })

  it('rejects wrong kind values', () => {
    expect(() => parseFacts('{"facts":[{"kind":"love","text":"xx xx"}]}')).toThrow()
  })

  it('rejects empty facts array', () => {
    expect(() => parseFacts('{"facts":[]}')).toThrow()
  })
})

describe('buildExtractMessages', () => {
  it('includes title and opinion in the user message', () => {
    const msgs = buildExtractMessages('Steins;Gate', 'nagyon tetszett a vége')
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].content).toContain('Steins;Gate')
    expect(msgs[1].content).toContain('nagyon tetszett a vége')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/extract.test.ts`
Expected: FAIL — cannot resolve `./extract`.

- [ ] **Step 3: Implement**

Create `src/lib/extract.ts`:

```ts
import { z } from 'zod'
import { glmChat, extractJson, type ChatMessage } from './glm'

export const factsSchema = z.object({
  facts: z.array(z.object({
    kind: z.enum(['like', 'dislike', 'note']),
    text: z.string().min(3).max(200),
  })).min(1).max(10),
})

export type Fact = z.infer<typeof factsSchema>['facts'][number]

const SYSTEM = `Ízlés-elemző vagy. A felhasználó egy animéről írt személyes véleményéből
kinyered a tömör ízlés-tényeket. Válaszolj KIZÁRÓLAG JSON-nal, ebben a formában:
{"facts":[{"kind":"like|dislike|note","text":"rövid magyar tény"}]}
Szabályok: 3-8 tény; "like" = ami tetszett, "dislike" = ami zavarta, "note" = egyéb
fontos megfigyelés az ízléséről; minden text max 1 rövid mondat, magyarul.`

export function buildExtractMessages(title: string, opinion: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Anime: ${title}\n\nVélemény:\n${opinion}` },
  ]
}

export function parseFacts(raw: string): Fact[] {
  return factsSchema.parse(extractJson(raw)).facts
}

export async function extractFacts(title: string, opinion: string): Promise<Fact[]> {
  const messages = buildExtractMessages(title, opinion)
  const first = await glmChat(messages)
  try {
    return parseFacts(first)
  } catch {
    const second = await glmChat([
      ...messages,
      { role: 'user', content: 'A válaszod nem volt érvényes JSON. Küldd újra, CSAK a JSON-t.' },
    ])
    return parseFacts(second)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/extract.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Opinion API route**

Create `src/app/api/opinion/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, opinions, tasteMemory } from '@/db/schema'
import { extractFacts } from '@/lib/extract'
import { and, eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const animeId = Number(req.nextUrl.searchParams.get('animeId'))
  if (!animeId) return NextResponse.json({ opinion: null })
  const [row] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
  return NextResponse.json({ opinion: row ?? null })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const animeId = Number(body?.animeId)
  if (!animeId) return NextResponse.json({ error: 'animeId kötelező' }, { status: 400 })

  const [animeRow] = await db.select().from(anime).where(eq(anime.id, animeId))
  if (!animeRow) return NextResponse.json({ error: 'Nincs ilyen anime' }, { status: 404 })

  let rawText: string
  if (body.retry === true) {
    const [existing] = await db.select().from(opinions).where(eq(opinions.animeId, animeId))
    if (!existing) return NextResponse.json({ error: 'Nincs mentett vélemény' }, { status: 404 })
    rawText = existing.rawText
  } else {
    rawText = String(body.rawText ?? '').trim()
    if (!rawText) return NextResponse.json({ error: 'Üres vélemény' }, { status: 400 })
    await db.insert(opinions)
      .values({ animeId, rawText, extractStatus: 'pending', updatedAt: new Date() })
      .onConflictDoUpdate({
        target: opinions.animeId,
        set: { rawText, extractStatus: 'pending', updatedAt: new Date() },
      })
  }

  try {
    const facts = await extractFacts(animeRow.titleRomaji, rawText)
    await db.delete(tasteMemory).where(
      and(eq(tasteMemory.animeId, animeId), eq(tasteMemory.source, 'opinion')),
    )
    const inserted = await db.insert(tasteMemory).values(
      facts.map((f) => ({ animeId, kind: f.kind, text: f.text, source: 'opinion' })),
    ).returning()
    await db.update(opinions).set({ extractStatus: 'done' }).where(eq(opinions.animeId, animeId))
    return NextResponse.json({ extractStatus: 'done', facts: inserted })
  } catch (e) {
    await db.update(opinions).set({ extractStatus: 'failed' }).where(eq(opinions.animeId, animeId))
    return NextResponse.json({ extractStatus: 'failed', error: String(e), facts: [] })
  }
}
```

- [ ] **Step 6: Taste fact delete route**

Create `src/app/api/taste/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { tasteMemory } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.delete(tasteMemory).where(eq(tasteMemory.id, Number(id)))
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Verify build + full test run**

Run: `npm run build` then `npm run test`
Expected: build success; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/extract.ts src/lib/extract.test.ts src/app/api/opinion src/app/api/taste
git commit -m "feat: opinion pipeline - GLM extracts taste facts into taste_memory with retry"
```

---

### Task 8: Graph builder (hierarchy → nodes/links)

**Files:**
- Create: `src/lib/graph-builder.ts`
- Test: `src/lib/graph-builder.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces (used verbatim by Task 9's Graph3D):
  - `type Dimension = 'genre' | 'studio' | 'scoreBand' | 'year' | 'status'`
  - `type GraphConfig = { levels: Dimension[]; crossLinks: boolean; sizeBy: 'score' | 'elo' }`
  - `DEFAULT_CONFIG: GraphConfig = { levels: ['genre', 'studio'], crossLinks: true, sizeBy: 'score' }`
  - `type GraphAnime = { id: number; anilistId: number; titleRomaji: string; coverUrl: string | null; genres: string[]; studio: string | null; year: number | null; status: string; myScore: number | null; elo: number; relations: { type: string; anilistId: number }[] }`
  - `type GraphNode = { id: string; type: 'dim' | 'anime'; label: string; img?: string; val: number; status?: string; animeId?: number; dim?: Dimension }`
  - `type GraphLink = { source: string; target: string; kind: 'chain' | 'relation' }`
  - `scoreBand(s: number | null): string`
  - `buildGraph(rows: GraphAnime[], cfg: GraphConfig): { nodes: GraphNode[]; links: GraphLink[] }`
  - `DIM_LABELS: Record<Dimension, string>` — Hungarian display names for the config panel

- [ ] **Step 1: Write the failing test**

Create `src/lib/graph-builder.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildGraph, scoreBand, type GraphAnime } from './graph-builder'

const mk = (over: Partial<GraphAnime>): GraphAnime => ({
  id: 1, anilistId: 100, titleRomaji: 'A', coverUrl: null,
  genres: ['Action'], studio: 'MAPPA', year: 2020, status: 'completed',
  myScore: 8, elo: 1200, relations: [], ...over,
})

describe('scoreBand', () => {
  it('bands scores', () => {
    expect(scoreBand(3)).toBe('1–4')
    expect(scoreBand(5)).toBe('5–6')
    expect(scoreBand(8)).toBe('7–8')
    expect(scoreBand(10)).toBe('9–10')
    expect(scoreBand(null)).toBe('Nincs pont')
  })
})

describe('buildGraph', () => {
  it('builds genre → studio → anime chain with path-scoped dim ids', () => {
    const rows = [
      mk({ id: 1, anilistId: 100, studio: 'MAPPA' }),
      mk({ id: 2, anilistId: 200, titleRomaji: 'B', studio: 'Bones' }),
    ]
    const g = buildGraph(rows, { levels: ['genre', 'studio'], crossLinks: false, sizeBy: 'score' })
    const ids = g.nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'anime:1', 'anime:2',
      'dim:genre:Action', 'dim:studio:Action/Bones', 'dim:studio:Action/MAPPA',
    ].sort())
    expect(g.links).toContainEqual({ source: 'dim:genre:Action', target: 'dim:studio:Action/MAPPA', kind: 'chain' })
    expect(g.links).toContainEqual({ source: 'dim:studio:Action/MAPPA', target: 'anime:1', kind: 'chain' })
    expect(g.links).toHaveLength(4)
  })

  it('same studio under different genres yields separate dim nodes (tree, not web)', () => {
    const rows = [
      mk({ id: 1, genres: ['Action'] }),
      mk({ id: 2, anilistId: 200, genres: ['Drama'] }),
    ]
    const g = buildGraph(rows, { levels: ['genre', 'studio'], crossLinks: false, sizeBy: 'score' })
    const studioNodes = g.nodes.filter((n) => n.dim === 'studio')
    expect(studioNodes.map((n) => n.id).sort()).toEqual(['dim:studio:Action/MAPPA', 'dim:studio:Drama/MAPPA'])
    expect(studioNodes.every((n) => n.label === 'MAPPA')).toBe(true)
  })

  it('empty levels → only anime nodes, no chain links', () => {
    const g = buildGraph([mk({})], { levels: [], crossLinks: false, sizeBy: 'score' })
    expect(g.nodes).toHaveLength(1)
    expect(g.links).toHaveLength(0)
  })

  it('crossLinks adds deduped relation edges only between owned anime', () => {
    const rows = [
      mk({ id: 1, anilistId: 100, relations: [{ type: 'SEQUEL', anilistId: 200 }] }),
      mk({ id: 2, anilistId: 200, titleRomaji: 'B', relations: [{ type: 'PREQUEL', anilistId: 100 }] }),
      mk({ id: 3, anilistId: 300, titleRomaji: 'C', relations: [{ type: 'SEQUEL', anilistId: 999 }] }),
    ]
    const g = buildGraph(rows, { levels: [], crossLinks: true, sizeBy: 'score' })
    const rel = g.links.filter((l) => l.kind === 'relation')
    expect(rel).toEqual([{ source: 'anime:1', target: 'anime:2', kind: 'relation' }])
  })

  it('sizeBy elo uses elo for node val', () => {
    const g = buildGraph([mk({ elo: 1500 })], { levels: [], crossLinks: false, sizeBy: 'elo' })
    expect(g.nodes[0].val).toBeCloseTo(1500 / 150)
  })

  it('anime with no genre falls into Ismeretlen', () => {
    const g = buildGraph([mk({ genres: [] })], { levels: ['genre'], crossLinks: false, sizeBy: 'score' })
    expect(g.nodes.some((n) => n.id === 'dim:genre:Ismeretlen')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/graph-builder.test.ts`
Expected: FAIL — cannot resolve `./graph-builder`.

- [ ] **Step 3: Implement**

Create `src/lib/graph-builder.ts`:

```ts
export type Dimension = 'genre' | 'studio' | 'scoreBand' | 'year' | 'status'

export type GraphConfig = {
  levels: Dimension[]
  crossLinks: boolean
  sizeBy: 'score' | 'elo'
}

export const DEFAULT_CONFIG: GraphConfig = {
  levels: ['genre', 'studio'],
  crossLinks: true,
  sizeBy: 'score',
}

export const DIM_LABELS: Record<Dimension, string> = {
  genre: 'Műfaj',
  studio: 'Stúdió',
  scoreBand: 'Pontszám-sáv',
  year: 'Év',
  status: 'Státusz',
}

export type GraphAnime = {
  id: number
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  studio: string | null
  year: number | null
  status: string
  myScore: number | null
  elo: number
  relations: { type: string; anilistId: number }[]
}

export type GraphNode = {
  id: string
  type: 'dim' | 'anime'
  label: string
  img?: string
  val: number
  status?: string
  animeId?: number
  dim?: Dimension
}

export type GraphLink = { source: string; target: string; kind: 'chain' | 'relation' }

const STATUS_LABELS: Record<string, string> = {
  watching: 'Nézem',
  completed: 'Kész',
  dropped: 'Dropped',
  planned: 'Tervezem',
}

export function scoreBand(s: number | null): string {
  if (s == null) return 'Nincs pont'
  if (s <= 4) return '1–4'
  if (s <= 6) return '5–6'
  if (s <= 8) return '7–8'
  return '9–10'
}

function dimValue(a: GraphAnime, d: Dimension): string {
  switch (d) {
    case 'genre': return a.genres[0] ?? 'Ismeretlen'
    case 'studio': return a.studio ?? 'Ismeretlen'
    case 'scoreBand': return scoreBand(a.myScore)
    case 'year': return a.year != null ? String(a.year) : 'Ismeretlen'
    case 'status': return STATUS_LABELS[a.status] ?? a.status
  }
}

const RELATION_TYPES = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'PARENT', 'ALTERNATIVE'])

export function buildGraph(rows: GraphAnime[], cfg: GraphConfig): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const linkSeen = new Set<string>()

  const addLink = (source: string, target: string, kind: GraphLink['kind']) => {
    const key = `${kind}|${source}|${target}`
    if (linkSeen.has(key)) return
    linkSeen.add(key)
    links.push({ source, target, kind })
  }

  for (const a of rows) {
    const animeNodeId = `anime:${a.id}`
    nodes.set(animeNodeId, {
      id: animeNodeId,
      type: 'anime',
      label: a.titleRomaji,
      img: a.coverUrl ?? undefined,
      val: cfg.sizeBy === 'elo' ? a.elo / 150 : (a.myScore ?? 5),
      status: a.status,
      animeId: a.id,
    })

    let prevId: string | null = null
    const path: string[] = []
    for (const level of cfg.levels) {
      const value = dimValue(a, level)
      path.push(value)
      const dimId = `dim:${level}:${path.join('/')}`
      if (!nodes.has(dimId)) {
        nodes.set(dimId, { id: dimId, type: 'dim', label: value, val: 12, dim: level })
      }
      if (prevId) addLink(prevId, dimId, 'chain')
      prevId = dimId
    }
    if (prevId) addLink(prevId, animeNodeId, 'chain')
  }

  if (cfg.crossLinks) {
    const byAnilist = new Map(rows.map((a) => [a.anilistId, a.id]))
    for (const a of rows) {
      for (const rel of a.relations) {
        if (!RELATION_TYPES.has(rel.type)) continue
        const targetId = byAnilist.get(rel.anilistId)
        if (targetId === undefined || targetId === a.id) continue
        const [lo, hi] = a.id < targetId ? [a.id, targetId] : [targetId, a.id]
        addLink(`anime:${lo}`, `anime:${hi}`, 'relation')
      }
    }
  }

  return { nodes: [...nodes.values()], links }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/graph-builder.test.ts`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph-builder.ts src/lib/graph-builder.test.ts
git commit -m "feat: configurable hierarchy graph builder (genre/studio/score/year/status levels, cross-links)"
```

---

### Task 9: 3D graph page (Graph3D, hierarchy panel, add-anime search)

**Files:**
- Create: `src/components/Graph3D.tsx`
- Create: `src/components/HierarchyPanel.tsx`
- Create: `src/components/AddAnimeSearch.tsx`
- Create: `src/lib/types.ts`
- Modify: `src/app/page.tsx` (replace scaffold content entirely)
- Modify: `src/app/globals.css` (body background)
- Modify: `src/app/layout.tsx` (metadata title)

**Interfaces:**
- Consumes: `buildGraph`, `GraphConfig`, `DEFAULT_CONFIG`, `DIM_LABELS`, types (Task 8); GET `/api/anime` (Task 5); GET `/api/anilist/search` (Task 4); POST `/api/anime` (Task 5)
- Produces:
  - `src/lib/types.ts`: `type ApiAnime` — the JSON shape of an `anime` row over the wire (`watchedAt`/`createdAt` as string | null), plus `type ApiFact = { id: number; animeId: number | null; kind: string; text: string }`. Used by Tasks 10 and 12.
  - `<Graph3D data={{nodes,links}} onAnimeClick={(animeId: number) => void} focusNodeId={string | null} />`
  - `<HierarchyPanel config={GraphConfig} onChange={(c: GraphConfig) => void} />` — persists to `localStorage` key `anime-graph-config`
  - `<AddAnimeSearch onAdded={() => void} />`
  - Page state contract for Task 10: `page.tsx` renders `selectedAnimeId` state and a `refresh()` that re-fetches `/api/anime`; Task 10 plugs `<SidePanel animeId={selectedAnimeId} ... />` into the marked slot.

- [ ] **Step 1: Shared wire types**

Create `src/lib/types.ts`:

```ts
import type { AnimeSelect } from '@/db/schema'

// anime row as it arrives over JSON (dates serialized)
export type ApiAnime = Omit<AnimeSelect, 'watchedAt' | 'createdAt'> & {
  watchedAt: string | null
  createdAt: string
}

export type ApiFact = { id: number; animeId: number | null; kind: string; text: string }
```

- [ ] **Step 2: Graph3D component**

Create `src/components/Graph3D.tsx`:

```tsx
'use client'
import { useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import type { GraphNode, GraphLink } from '@/lib/graph-builder'

// dynamic() drops refs, so wrap and pass the ref as a normal prop
const ForceGraph3D = dynamic(
  () => import('react-force-graph-3d').then((m) => {
    const FG = m.default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Wrapper = ({ fgRef, ...props }: any) => <FG ref={fgRef} {...props} />
    return Wrapper
  }),
  { ssr: false },
)

const STATUS_TINT: Record<string, number> = {
  completed: 0xffffff,
  watching: 0xffffff,
  planned: 0x8899aa,
  dropped: 0x555555,
}

const texLoader = new THREE.TextureLoader()
texLoader.setCrossOrigin('anonymous')
const texCache = new Map<string, THREE.Texture>()

function animeObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const size = Math.max(6, Math.min(16, node.val * 1.5))
  if (node.img) {
    let tex = texCache.get(node.img)
    if (!tex) {
      tex = texLoader.load(node.img)
      texCache.set(node.img, tex)
    }
    const mat = new THREE.SpriteMaterial({ map: tex })
    mat.color.setHex(STATUS_TINT[node.status ?? 'planned'] ?? 0xffffff)
    const sprite = new THREE.Sprite(mat)
    sprite.scale.set(size * 0.7, size, 1)
    group.add(sprite)
  } else {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size / 3),
      new THREE.MeshLambertMaterial({ color: 0x66ddff }),
    )
    group.add(mesh)
  }
  if (node.status === 'watching') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.55, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x22ffcc }),
    )
    group.add(ring)
  }
  return group
}

function dimObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(3),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
  )
  const label = new SpriteText(node.label, 4, '#bae6fd')
  label.position.set(0, 6, 0)
  group.add(sphere, label)
  return group
}

export default function Graph3D({
  data,
  onAnimeClick,
  focusNodeId,
}: {
  data: { nodes: GraphNode[]; links: GraphLink[] }
  onAnimeClick: (animeId: number) => void
  focusNodeId: string | null
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  // clone: force-graph mutates node objects (adds x/y/z)
  const graphData = useMemo(() => ({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  }), [data])

  // bloom pass, added once the underlying lib instance exists
  useEffect(() => {
    const timer = setInterval(() => {
      const fg = fgRef.current
      if (!fg) return
      clearInterval(timer)
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js').then(({ UnrealBloomPass }) => {
        const pass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.1, 0.5, 0.15)
        fg.postProcessingComposer().addPass(pass)
      })
    }, 200)
    return () => clearInterval(timer)
  }, [])

  // fly to a node when asked (search hit / external focus)
  useEffect(() => {
    if (!focusNodeId || !fgRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = fgRef.current.graphData().nodes.find((n: any) => n.id === focusNodeId)
    if (!node || node.x === undefined) return
    flyTo(node)
  }, [focusNodeId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function flyTo(node: any) {
    const dist = 70
    const len = Math.hypot(node.x, node.y, node.z) || 1
    const ratio = 1 + dist / len
    fgRef.current.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      node,
      1200,
    )
  }

  return (
    <ForceGraph3D
      fgRef={fgRef}
      graphData={graphData}
      backgroundColor="#04060f"
      nodeThreeObject={(n: GraphNode) => (n.type === 'anime' ? animeObject(n) : dimObject(n))}
      nodeLabel={(n: GraphNode) => n.label}
      linkColor={(l: GraphLink) => (l.kind === 'relation' ? '#f472b6' : '#334155')}
      linkOpacity={0.5}
      linkWidth={(l: GraphLink) => (l.kind === 'relation' ? 1.5 : 0.5)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeClick={(n: any) => {
        flyTo(n)
        if (n.type === 'anime' && n.animeId) onAnimeClick(n.animeId)
      }}
    />
  )
}
```

- [ ] **Step 3: Hierarchy config panel**

Create `src/components/HierarchyPanel.tsx`:

```tsx
'use client'
import { type Dimension, type GraphConfig, DIM_LABELS } from '@/lib/graph-builder'

const ALL_DIMS: Dimension[] = ['genre', 'studio', 'scoreBand', 'year', 'status']

export default function HierarchyPanel({
  config,
  onChange,
}: {
  config: GraphConfig
  onChange: (c: GraphConfig) => void
}) {
  const inactive = ALL_DIMS.filter((d) => !config.levels.includes(d))

  function move(i: number, dir: -1 | 1) {
    const levels = [...config.levels]
    const j = i + dir
    if (j < 0 || j >= levels.length) return
    ;[levels[i], levels[j]] = [levels[j], levels[i]]
    onChange({ ...config, levels })
  }

  return (
    <div className="w-60 rounded-xl bg-slate-900/85 border border-slate-700 p-4 text-sm text-slate-200 backdrop-blur">
      <h2 className="font-semibold mb-2">Hierarchia-szintek</h2>
      <ul className="flex flex-col gap-1 mb-3">
        {config.levels.map((d, i) => (
          <li key={d} className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1">
            <span className="flex-1">{i + 1}. {DIM_LABELS[d]}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === config.levels.length - 1} className="disabled:opacity-30">▼</button>
            <button
              onClick={() => onChange({ ...config, levels: config.levels.filter((x) => x !== d) })}
              className="text-red-400"
              title="Szint kikapcsolása"
            >✕</button>
          </li>
        ))}
        {config.levels.length === 0 && <li className="text-slate-500 italic">Nincs szint — csak animék</li>}
      </ul>
      {inactive.length > 0 && (
        <div className="mb-3">
          <p className="text-slate-400 mb-1">Hozzáadható:</p>
          <div className="flex flex-wrap gap-1">
            {inactive.map((d) => (
              <button
                key={d}
                onClick={() => onChange({ ...config, levels: [...config.levels, d] })}
                className="rounded-full border border-slate-600 px-2 py-0.5 hover:border-cyan-400"
              >+ {DIM_LABELS[d]}</button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 mb-1">
        <input
          type="checkbox"
          checked={config.crossLinks}
          onChange={(e) => onChange({ ...config, crossLinks: e.target.checked })}
        />
        Sequel/prequel élek
      </label>
      <label className="flex items-center gap-2">
        Méret:
        <select
          value={config.sizeBy}
          onChange={(e) => onChange({ ...config, sizeBy: e.target.value as GraphConfig['sizeBy'] })}
          className="bg-slate-800 rounded px-1 py-0.5"
        >
          <option value="score">Pontszám</option>
          <option value="elo">Elo</option>
        </select>
      </label>
    </div>
  )
}
```

- [ ] **Step 4: Add-anime search box**

Create `src/components/AddAnimeSearch.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { SearchResult } from '@/lib/anilist'

export default function AddAnimeSearch({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/anilist/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) setResults((await res.json()).results)
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  async function add(anilistId: number) {
    setBusy(anilistId)
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    setBusy(null)
    if (res.ok) { setQ(''); setResults([]); onAdded() }
  }

  return (
    <div className="w-72 relative text-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Anime hozzáadása…"
        className="w-full rounded-xl bg-slate-900/85 border border-slate-700 px-3 py-2 text-slate-200 outline-none focus:border-cyan-400 backdrop-blur"
      />
      {results.length > 0 && (
        <ul className="absolute mt-1 w-full max-h-80 overflow-auto rounded-xl bg-slate-900 border border-slate-700 z-20">
          {results.map((r) => (
            <li key={r.anilistId}>
              <button
                onClick={() => add(r.anilistId)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2 px-2 py-1.5 hover:bg-slate-800 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.coverUrl && <img src={r.coverUrl} alt="" className="w-8 h-11 object-cover rounded" />}
                <span className="flex-1 text-slate-200">
                  {r.titleRomaji}
                  <span className="block text-xs text-slate-400">{r.year ?? '?'} · {r.format ?? '?'}</span>
                </span>
                {busy === r.anilistId && <span className="text-cyan-400">…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Main page**

Replace `src/app/page.tsx` entirely:

```tsx
'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Graph3D from '@/components/Graph3D'
import HierarchyPanel from '@/components/HierarchyPanel'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import { buildGraph, DEFAULT_CONFIG, type GraphConfig } from '@/lib/graph-builder'
import type { ApiAnime, ApiFact } from '@/lib/types'

const CONFIG_KEY = 'anime-graph-config'

export default function Home() {
  const [animeList, setAnimeList] = useState<ApiAnime[]>([])
  const [facts, setFacts] = useState<ApiFact[]>([])
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_CONFIG)
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) try { setConfig(JSON.parse(saved)) } catch { /* keep default */ }
    setLoaded(true)
  }, [])

  function updateConfig(c: GraphConfig) {
    setConfig(c)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  }

  const refresh = useCallback(async () => {
    const res = await fetch('/api/anime')
    if (res.ok) {
      const json = await res.json()
      setAnimeList(json.anime)
      setFacts(json.facts)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const graph = useMemo(() => buildGraph(
    animeList.map((a) => ({
      id: a.id, anilistId: a.anilistId, titleRomaji: a.titleRomaji,
      coverUrl: a.coverUrl, genres: a.genres, studio: a.studio, year: a.year,
      status: a.status, myScore: a.myScore, elo: a.elo, relations: a.relations,
    })),
    config,
  ), [animeList, config])

  if (!loaded) return null

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Graph3D data={graph} onAnimeClick={setSelectedAnimeId} focusNodeId={null} />
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
        <AddAnimeSearch onAdded={refresh} />
        <HierarchyPanel config={config} onChange={updateConfig} />
      </div>
      {/* Task 12 mounts the Recommend button here (top-right) */}
      {/* Task 10 mounts <SidePanel> here, driven by selectedAnimeId + facts + refresh */}
      {selectedAnimeId && (
        <div className="absolute top-4 right-4 z-10 text-slate-400 text-sm bg-slate-900/85 rounded-xl border border-slate-700 p-3">
          Kiválasztva: #{selectedAnimeId} (panel a következő taskban)
        </div>
      )}
    </main>
  )
}
```

In `src/app/layout.tsx` set the metadata title:

```ts
export const metadata: Metadata = {
  title: 'Anime Graph',
  description: 'Személyes 3D anime-térkép',
}
```

In `src/app/globals.css` after the Tailwind import, set:

```css
body {
  background: #04060f;
}
```

- [ ] **Step 6: Verify build + visual smoke**

Run: `npm run build`
Expected: success.

With user-provided `.env.local` (real `DATABASE_URL` after user ran `db:push`): `npm run dev`, log in, add one anime via search, expect a cover-sprite node under its genre/studio chain. If no DB yet, verify only that the page renders the empty graph without errors.

Take a Playwright/agent-browser screenshot of `/` after login and LOOK at it: dark background, panels top-left. Graph visuals verified properly in Task 13 with data.

- [ ] **Step 7: Commit**

```bash
git add src/components src/lib/types.ts src/app/page.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: 3D graph page with cover-sprite nodes, hierarchy config panel, AniList add-search"
```

---

### Task 10: Side panel (details, status, opinion editor, facts, trailer)

**Files:**
- Create: `src/components/SidePanel.tsx`
- Modify: `src/app/page.tsx` (mount panel in the marked slot)

**Interfaces:**
- Consumes: `ApiAnime`, `ApiFact` (Task 9); PATCH/DELETE `/api/anime/[id]` (Task 5); GET/POST `/api/opinion`, DELETE `/api/taste/[id]` (Task 7)
- Produces: `<SidePanel anime={ApiAnime} facts={ApiFact[]} onClose={() => void} onChanged={() => void} />` — `onChanged` triggers the page `refresh()`.

- [ ] **Step 1: Implement SidePanel**

Create `src/components/SidePanel.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { ApiAnime, ApiFact } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: 'watching', label: 'Nézem' },
  { value: 'completed', label: 'Kész' },
  { value: 'planned', label: 'Tervezem' },
  { value: 'dropped', label: 'Dropped' },
]

const KIND_BADGE: Record<string, string> = {
  like: 'text-emerald-400',
  dislike: 'text-red-400',
  note: 'text-slate-400',
}

export default function SidePanel({
  anime, facts, onClose, onChanged,
}: {
  anime: ApiAnime
  facts: ApiFact[]
  onClose: () => void
  onChanged: () => void
}) {
  const [opinion, setOpinion] = useState('')
  const [extractStatus, setExtractStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOpinion('')
    setExtractStatus(null)
    fetch(`/api/opinion?animeId=${anime.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.opinion) { setOpinion(j.opinion.rawText); setExtractStatus(j.opinion.extractStatus) }
      })
  }, [anime.id])

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/anime/${anime.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    onChanged()
  }

  async function saveOpinion(retry = false) {
    setSaving(true)
    const res = await fetch('/api/opinion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retry ? { animeId: anime.id, retry: true } : { animeId: anime.id, rawText: opinion }),
    })
    const json = await res.json()
    setExtractStatus(json.extractStatus)
    setSaving(false)
    onChanged()
  }

  async function deleteFact(id: number) {
    await fetch(`/api/taste/${id}`, { method: 'DELETE' })
    onChanged()
  }

  async function remove() {
    if (!confirm(`Törlöd: ${anime.titleRomaji}?`)) return
    await fetch(`/api/anime/${anime.id}`, { method: 'DELETE' })
    onClose()
    onChanged()
  }

  const myFacts = facts.filter((f) => f.animeId === anime.id)

  return (
    <aside className="absolute top-0 right-0 z-10 h-screen w-96 overflow-y-auto bg-slate-950/95 border-l border-slate-700 text-slate-200 text-sm backdrop-blur">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {anime.coverUrl && <img src={anime.coverUrl} alt="" className="w-20 rounded-lg" />}
          <div className="flex-1">
            <h2 className="font-semibold text-base leading-tight">{anime.titleRomaji}</h2>
            {anime.titleEnglish && <p className="text-slate-400">{anime.titleEnglish}</p>}
            <p className="text-xs text-slate-500 mt-1">
              {anime.year ?? '?'} · {anime.format ?? '?'} · {anime.episodes ?? '?'} rész · {anime.studio ?? '?'}
            </p>
            <p className="text-xs text-slate-500">{anime.genres.join(', ')}</p>
            <a
              href={`https://anilist.co/anime/${anime.anilistId}`}
              target="_blank" rel="noreferrer"
              className="text-xs text-cyan-400 hover:underline"
            >AniList ↗</a>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={anime.status}
            onChange={(e) => patch({ status: e.target.value })}
            className="bg-slate-800 rounded px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-1">
            Rész:
            <input
              type="number" min={0} value={anime.progress}
              onChange={(e) => patch({ progress: Number(e.target.value) })}
              className="w-16 bg-slate-800 rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            Pont:
            <input
              type="number" min={1} max={10} value={anime.myScore ?? ''}
              onChange={(e) => patch({ myScore: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-14 bg-slate-800 rounded px-2 py-1"
            />
          </label>
        </div>

        <section>
          <h3 className="font-semibold mb-1">Véleményem</h3>
          <textarea
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            rows={5}
            placeholder="Mi tetszett? Mi nem? Írd le szabadon…"
            className="w-full rounded-lg bg-slate-800 border border-slate-600 p-2 outline-none focus:border-cyan-400"
          />
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => saveOpinion()}
              disabled={saving || !opinion.trim()}
              className="rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-3 py-1 disabled:opacity-40"
            >{saving ? 'Mentés…' : 'Mentés + AI-kivonat'}</button>
            {extractStatus === 'failed' && (
              <button onClick={() => saveOpinion(true)} className="text-amber-400 hover:underline">
                Kivonat újra ↻
              </button>
            )}
            {extractStatus === 'done' && <span className="text-emerald-400 text-xs">✓ kivonatolva</span>}
          </div>
        </section>

        {myFacts.length > 0 && (
          <section>
            <h3 className="font-semibold mb-1">Ízlés-memória</h3>
            <ul className="flex flex-col gap-1">
              {myFacts.map((f) => (
                <li key={f.id} className="flex items-start gap-2 rounded bg-slate-900 px-2 py-1">
                  <span className={`${KIND_BADGE[f.kind] ?? ''} text-xs mt-0.5`}>
                    {f.kind === 'like' ? '▲' : f.kind === 'dislike' ? '▼' : '•'}
                  </span>
                  <span className="flex-1">{f.text}</span>
                  <button onClick={() => deleteFact(f.id)} className="text-slate-500 hover:text-red-400">✕</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="font-semibold mb-1">Opening / trailer</h3>
          {anime.trailerSite === 'youtube' && anime.trailerId ? (
            <iframe
              className="w-full aspect-video rounded-lg"
              src={`https://www.youtube-nocookie.com/embed/${anime.trailerId}`}
              title="Trailer"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(anime.titleRomaji + ' opening')}`}
              target="_blank" rel="noreferrer"
              className="text-cyan-400 hover:underline"
            >Opening keresése YouTube-on ↗</a>
          )}
        </section>

        <button onClick={remove} className="text-red-400 hover:underline self-start">Anime törlése</button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Mount in page.tsx**

In `src/app/page.tsx`: add import `import SidePanel from '@/components/SidePanel'`, and replace the placeholder `{selectedAnimeId && (...)}` block with:

```tsx
{selectedAnime && (
  <SidePanel
    anime={selectedAnime}
    facts={facts}
    onClose={() => setSelectedAnimeId(null)}
    onChanged={refresh}
  />
)}
```

and above the `return`, derive:

```tsx
const selectedAnime = animeList.find((a) => a.id === selectedAnimeId) ?? null
```

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build` — success expected.
Dev-server check with DB: click an anime node → panel opens; change status to "Kész"; write a short opinion, save; expect facts to appear (needs valid `GLM_API_KEY`), or `failed` status + retry button without one.

- [ ] **Step 4: Commit**

```bash
git add src/components/SidePanel.tsx src/app/page.tsx
git commit -m "feat: anime side panel - status/score controls, opinion editor with AI facts, trailer embed"
```

---

### Task 11: Candidate generation (pure)

**Files:**
- Create: `src/lib/candidates.ts`
- Test: `src/lib/candidates.test.ts`

**Interfaces:**
- Consumes: `RecCandidate` type (Task 4)
- Produces (used by Task 12):
  - `genreWeights(rows: { genres: string[]; myScore: number | null; elo: number }[]): Map<string, number>`
  - `rankCandidates(cands: RecCandidate[], ownedAnilistIds: Set<number>, weights: Map<string, number>, limit?: number): RecCandidate[]` — dedupes by anilistId, excludes owned, sorts by genre-weight overlap + AniList avg score, returns top `limit` (default 30)

- [ ] **Step 1: Write the failing test**

Create `src/lib/candidates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { genreWeights, rankCandidates } from './candidates'
import type { RecCandidate } from './anilist'

const cand = (id: number, genres: string[], avgScore = 70): RecCandidate => ({
  anilistId: id, title: `T${id}`, coverUrl: null, genres, avgScore,
})

describe('genreWeights', () => {
  it('weights genres by score above/below neutral 5 and elo offset', () => {
    const w = genreWeights([
      { genres: ['Action'], myScore: 9, elo: 1200 },   // +4
      { genres: ['Drama'], myScore: 3, elo: 1200 },    // -2
      { genres: ['Action'], myScore: null, elo: 1400 }, // 0 + 0.5
    ])
    expect(w.get('Action')).toBeCloseTo(4.5)
    expect(w.get('Drama')).toBeCloseTo(-2)
  })
})

describe('rankCandidates', () => {
  it('excludes owned and dedupes', () => {
    const out = rankCandidates(
      [cand(1, ['Action']), cand(1, ['Action']), cand(2, ['Action'])],
      new Set([2]),
      new Map([['Action', 3]]),
    )
    expect(out.map((c) => c.anilistId)).toEqual([1])
  })

  it('ranks higher genre-weight overlap first', () => {
    const out = rankCandidates(
      [cand(1, ['Drama'], 80), cand(2, ['Action'], 60)],
      new Set(),
      new Map([['Action', 5], ['Drama', -1]]),
    )
    expect(out[0].anilistId).toBe(2)
  })

  it('applies the limit', () => {
    const cands = Array.from({ length: 40 }, (_, i) => cand(i + 1, ['Action']))
    expect(rankCandidates(cands, new Set(), new Map(), 30)).toHaveLength(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/candidates.test.ts`
Expected: FAIL — cannot resolve `./candidates`.

- [ ] **Step 3: Implement**

Create `src/lib/candidates.ts`:

```ts
import type { RecCandidate } from './anilist'

export function genreWeights(
  rows: { genres: string[]; myScore: number | null; elo: number }[],
): Map<string, number> {
  const w = new Map<string, number>()
  for (const r of rows) {
    const scorePart = r.myScore != null ? r.myScore - 5 : 0
    const eloPart = (r.elo - 1200) / 400
    for (const g of r.genres) {
      w.set(g, (w.get(g) ?? 0) + scorePart + eloPart)
    }
  }
  return w
}

export function rankCandidates(
  cands: RecCandidate[],
  ownedAnilistIds: Set<number>,
  weights: Map<string, number>,
  limit = 30,
): RecCandidate[] {
  const seen = new Set<number>()
  const unique: RecCandidate[] = []
  for (const c of cands) {
    if (ownedAnilistIds.has(c.anilistId) || seen.has(c.anilistId)) continue
    seen.add(c.anilistId)
    unique.push(c)
  }
  const score = (c: RecCandidate) =>
    c.genres.reduce((s, g) => s + (weights.get(g) ?? 0), 0) + (c.avgScore ?? 60) / 100
  return unique.sort((a, b) => score(b) - score(a)).slice(0, limit)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/candidates.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/candidates.ts src/lib/candidates.test.ts
git commit -m "feat: recommendation candidate ranking by taste-weighted genre overlap"
```

---

### Task 12: Recommend me — GLM rerank, API, UI

**Files:**
- Create: `src/lib/recommend.ts`
- Test: `src/lib/recommend.test.ts`
- Create: `src/app/api/recommend/route.ts`
- Create: `src/components/RecommendModal.tsx`
- Modify: `src/app/page.tsx` (mount button + modal)

**Interfaces:**
- Consumes: `glmChat`/`extractJson` (Task 6), `fetchRecommendationsFor`/`RecCandidate` (Task 4), `genreWeights`/`rankCandidates` (Task 11), `db` + tables (Task 2)
- Produces:
  - `picksSchema` (zod) → `type Pick = { anilistId: number; reason: string }`
  - `buildRecommendMessages(candidates: RecCandidate[], facts: { kind: string; text: string; title: string | null }[], topTitles: string[]): ChatMessage[]` (pure)
  - `parsePicks(raw: string): Pick[]` (pure, tested)
  - POST `/api/recommend` → `{ picks: { anilistId, title, coverUrl, genres, avgScore, reason }[] }` (also persisted to `recommendations` table with `kind:'recommend'`)
  - `<RecommendModal onAdded={() => void} />` — button + modal, self-contained

- [ ] **Step 1: Write the failing test**

Create `src/lib/recommend.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parsePicks, buildRecommendMessages } from './recommend'
import type { RecCandidate } from './anilist'

describe('parsePicks', () => {
  it('parses valid picks', () => {
    const raw = '{"picks":[{"anilistId":123,"reason":"a Steins;Gate-nél a plot-twisteket dicsérted"}]}'
    expect(parsePicks(raw)).toEqual([{ anilistId: 123, reason: 'a Steins;Gate-nél a plot-twisteket dicsérted' }])
  })

  it('rejects picks without anilistId', () => {
    expect(() => parsePicks('{"picks":[{"reason":"xx xx xx"}]}')).toThrow()
  })
})

describe('buildRecommendMessages', () => {
  it('lists candidates with ids and includes taste facts', () => {
    const cands: RecCandidate[] = [
      { anilistId: 5, title: 'Monogatari', coverUrl: null, genres: ['Mystery'], avgScore: 85 },
    ]
    const msgs = buildRecommendMessages(
      cands,
      [{ kind: 'like', text: 'gyors tempó tetszett', title: 'FMA:B' }],
      ['FMA:B'],
    )
    expect(msgs[1].content).toContain('[5] Monogatari')
    expect(msgs[1].content).toContain('gyors tempó tetszett')
    expect(msgs[1].content).toContain('FMA:B')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/recommend.test.ts`
Expected: FAIL — cannot resolve `./recommend`.

- [ ] **Step 3: Implement recommend lib**

Create `src/lib/recommend.ts`:

```ts
import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'
import type { RecCandidate } from './anilist'

export const picksSchema = z.object({
  picks: z.array(z.object({
    anilistId: z.number().int(),
    reason: z.string().min(5).max(300),
  })).min(1).max(10),
})

export type RecPick = z.infer<typeof picksSchema>['picks'][number]

const SYSTEM = `Anime-ajánló vagy. A felhasználó ízlés-memóriája és kedvenc animéi alapján
kiválasztod a jelöltlistából az 5-10 legjobban passzoló animét. Minden választáshoz rövid,
SZEMÉLYES magyar indoklást írsz, ami a felhasználó konkrét ízlés-tényeire hivatkozik.
Válaszolj KIZÁRÓLAG JSON-nal: {"picks":[{"anilistId":szám,"reason":"indoklás"}]}
Csak a jelöltlistában szereplő anilistId-ket használhatod.`

export function buildRecommendMessages(
  candidates: RecCandidate[],
  facts: { kind: string; text: string; title: string | null }[],
  topTitles: string[],
): ChatMessage[] {
  const candLines = candidates.map((c) =>
    `[${c.anilistId}] ${c.title} — műfaj: ${c.genres.join(', ')}; AniList-átlag: ${c.avgScore ?? '?'}`,
  ).join('\n')
  const factLines = facts.map((f) =>
    `- (${f.kind}${f.title ? `, ${f.title}` : ''}) ${f.text}`,
  ).join('\n')
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Kedvenc animéim (legjobbra értékelt): ${topTitles.join(', ') || 'nincs még'}\n\n` +
        `Ízlés-memóriám:\n${factLines || '- (még üres)'}\n\nJelöltlista:\n${candLines}`,
    },
  ]
}

export function parsePicks(raw: string): RecPick[] {
  return picksSchema.parse(extractJson(raw)).picks
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/recommend.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Recommend API route**

Create `src/app/api/recommend/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory, recommendations } from '@/db/schema'
import { fetchRecommendationsFor, type RecCandidate } from '@/lib/anilist'
import { genreWeights, rankCandidates } from '@/lib/candidates'
import { buildRecommendMessages, parsePicks } from '@/lib/recommend'
import { glmChat } from '@/lib/glm'

export async function POST() {
  const rows = await db.select().from(anime)
  if (!rows.length) {
    return NextResponse.json({ error: 'Előbb adj hozzá animéket' }, { status: 400 })
  }

  // top 5 by my score (fallback elo) → pull AniList recommendations for each
  const top = [...rows]
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0) || b.elo - a.elo)
    .slice(0, 5)
  const pools = await Promise.allSettled(top.map((t) => fetchRecommendationsFor(t.anilistId)))
  const candidates: RecCandidate[] = pools
    .filter((p): p is PromiseFulfilledResult<RecCandidate[]> => p.status === 'fulfilled')
    .flatMap((p) => p.value)
  if (!candidates.length) {
    return NextResponse.json({ error: 'AniList nem adott jelölteket, próbáld újra' }, { status: 502 })
  }

  const owned = new Set(rows.map((r) => r.anilistId))
  const weights = genreWeights(rows)
  const ranked = rankCandidates(candidates, owned, weights, 30)

  const factRows = await db.select({
    kind: tasteMemory.kind,
    text: tasteMemory.text,
    animeId: tasteMemory.animeId,
  }).from(tasteMemory)
  const titleById = new Map(rows.map((r) => [r.id, r.titleRomaji]))
  const facts = factRows.map((f) => ({
    kind: f.kind, text: f.text,
    title: f.animeId != null ? titleById.get(f.animeId) ?? null : null,
  }))

  try {
    const raw = await glmChat(buildRecommendMessages(ranked, facts, top.map((t) => t.titleRomaji)))
    const picks = parsePicks(raw)
    const byId = new Map(ranked.map((c) => [c.anilistId, c]))
    const result = picks
      .filter((p) => byId.has(p.anilistId))
      .map((p) => ({ ...byId.get(p.anilistId)!, reason: p.reason }))
    await db.insert(recommendations).values({
      kind: 'recommend',
      input: { topTitles: top.map((t) => t.titleRomaji), candidateCount: ranked.length },
      result,
    })
    return NextResponse.json({ picks: result })
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
```

- [ ] **Step 6: Recommend UI**

Create `src/components/RecommendModal.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { RecCandidate } from '@/lib/anilist'

type PickResult = RecCandidate & { reason: string }

export default function RecommendModal({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<PickResult[]>([])
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())

  async function run() {
    setOpen(true)
    setLoading(true)
    setError('')
    setPicks([])
    const res = await fetch('/api/recommend', { method: 'POST' })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setPicks(json.picks)
  }

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) {
      setAdded((s) => new Set(s).add(anilistId))
      onAdded()
    }
  }

  return (
    <>
      <button
        onClick={run}
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-5 py-2.5 font-bold text-slate-950 shadow-lg shadow-cyan-500/30 hover:brightness-110"
      >
        ✨ Recommend me
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] w-[min(90vw,42rem)] overflow-y-auto rounded-2xl bg-slate-950 border border-slate-700 p-5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Ajánlások neked</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            {loading && <p className="text-cyan-400 animate-pulse">Az ízlésed elemzése…</p>}
            {error && <p className="text-red-400">{error}</p>}
            <ul className="flex flex-col gap-3">
              {picks.map((p) => (
                <li key={p.anilistId} className="flex gap-3 rounded-xl bg-slate-900 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="w-16 rounded-lg self-start" />}
                  <div className="flex-1">
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-xs text-slate-500 mb-1">{p.genres.join(', ')} · AniList {p.avgScore ?? '?'}</p>
                    <p className="text-sm text-slate-300">{p.reason}</p>
                  </div>
                  <button
                    onClick={() => addToPlanned(p.anilistId)}
                    disabled={added.has(p.anilistId)}
                    className="self-start rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs disabled:text-emerald-400"
                  >
                    {added.has(p.anilistId) ? '✓ Tervezem' : '+ Tervezem'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
```

In `src/app/page.tsx`: import `RecommendModal` and replace the `{/* Task 12 mounts the Recommend button here (top-right) */}` comment with:

```tsx
<div className="absolute top-4 right-4 z-10">
  <RecommendModal onAdded={refresh} />
</div>
```

Note: when the SidePanel is open it overlaps the top-right corner — move the Recommend button container to `top-4 right-[25rem]` when `selectedAnime` is set: `className={selectedAnime ? 'absolute top-4 right-[25rem] z-10' : 'absolute top-4 right-4 z-10'}`.

- [ ] **Step 7: Verify build + tests**

Run: `npm run build` then `npm run test`
Expected: build success, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/recommend.ts src/lib/recommend.test.ts src/app/api/recommend src/components/RecommendModal.tsx src/app/page.tsx
git commit -m "feat: Recommend me - candidate pool + GLM rerank with personal reasons, modal UI"
```

---

### Task 13: README, final verification, visual smoke

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything
- Produces: user-facing setup instructions; verified working app.

- [ ] **Step 1: Write README**

Create `README.md`:

```markdown
# Anime Graph

Személyes 3D anime-térkép: hierarchikus gráf (műfaj → stúdió → anime), animénkénti
vélemények AI-ízlésmemóriával, és egy "Recommend me" gomb, ami GLM-mel ajánl.

## Beüzemelés (kézzel, saját fiókokkal!)

1. Neon: hozz létre adatbázist, másold ki a connection stringet.
2. `.env.local` a repo gyökerébe (minta: `.env.example`):
   - `DATABASE_URL`, `GLM_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET`
3. Séma feltolása (a drizzle-kit NEM olvassa a .env.local-t automatikusan):
   - PowerShell: `$env:DATABASE_URL="postgres://..."; npm run db:push`
4. `npm install`, majd `npm run dev` → http://localhost:3000
5. Vercel: importáld a repót a SAJÁT (nem céges!) fiókodba, állítsd be ugyanezt
   a 4 env-változót, deploy.

## Parancsok

- `npm run dev` / `npm run build` — fejlesztés / build
- `npm run test` — vitest unit tesztek (DB/hálózat nélkül futnak)
- `npm run db:generate` / `npm run db:push` — Drizzle migrációk

## Architektúra

- `src/lib/` — tesztelt tiszta logika: `graph-builder` (hierarchia → node/link),
  `candidates` (jelölt-rangsor), `extract` (vélemény → ízlés-tények), `glm`, `anilist`
- `src/app/api/` — vékony route-ok a libek fölött
- `src/components/` — `Graph3D` (react-force-graph-3d + bloom), `SidePanel`,
  `HierarchyPanel`, `AddAnimeSearch`, `RecommendModal`
```

- [ ] **Step 2: Full test + build run**

Run: `npm run test`
Expected: all suites pass (auth 3, anilist 3, glm 4, extract 4, graph-builder 7, candidates 4, recommend 3 ≈ 28 tests).

Run: `npm run build`
Expected: success, no type or lint errors.

- [ ] **Step 3: End-to-end smoke (needs user-provided .env.local + pushed schema)**

With dev server running, walk the core loop and LOOK at a screenshot at each stage (agent-browser or Playwright MCP):
1. `/` redirects to `/login`; log in.
2. Add 3 anime via search (pick ones with sequel relations, e.g. "Steins;Gate" and "Steins;Gate 0").
3. Verify graph: cover sprites under genre/studio chains; pink relation edge between the two Steins;Gate entries; toggling levels in the hierarchy panel rebuilds the graph; removing all levels leaves floating covers.
4. Open side panel, set status "Kész", score 9; write a 3-4 sentence Hungarian opinion, save → facts appear with ▲/▼ markers.
5. Press "✨ Recommend me" → picks render with covers and Hungarian reasons; "+ Tervezem" adds one, it appears in the graph faded (planned tint).

If any stage fails: STOP and use superpowers:systematic-debugging before proceeding.

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: setup and architecture README"
```

---

## Deferred to Plan 2 (extras — written after core ships)

Vibe-keresés (+ anime-picker), Duel/Elo page, Timeline gráf-mód, Szezonális radar, `/stats` dashboard, AniList/MAL import, `/settings` oldal (globális ízlés-listák → `taste_memory` source='settings', hierarchia-default DB-ben). The schema already contains `duels`, `recommendations.kind`, `taste_memory.source`, and `elo` so Plan 2 needs no migration for these.
