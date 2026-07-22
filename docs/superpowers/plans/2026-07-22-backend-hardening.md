# Backend-hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Csökkenteni az AniList-függőséget (offline-db → `title`), réteges AI-kvótát + költség-logot bevezetni, a publikus linket audit-lezárni, és a core loop edge-eseteit stabilizálni — UI érintése nélkül.

**Architecture:** A tesztelhető logika mind **pure függvénybe** kerül `src/lib/`-be (a repo mintája: vitest pure-fn tesztek, nincs db-mock). A route-ok/scriptek vékonyak; DB-interakciót a user futtatja Neonon, én `tsc`+`eslint`+vitest-tel verifikálok. offline-db a MEGLÉVŐ `title` katalógusba upsertel (nem új tábla). Négy fázis, a migráció-mentesek (A,B) elöl, a DB-migrációsak (C,D) hátul.

**Tech Stack:** Next.js 15.5.20, React 19, Neon Postgres + Drizzle 0.45, vitest 4, GLM `glm-4.7-flash` (OpenRouter/deepseek-free fallback), manami anime-offline-database (MIT), GitHub Actions cron.

## Global Constraints

- **Design/styling fájlokhoz TILOS nyúlni** — a working-tree uncommitted design-változásai (`src/app/page.tsx`, `src/components/GlassCard.tsx`, `HeroSlideshow.tsx`, `reactbits/`, `globals.css`, `layout.tsx`, `Countdown.tsx`, `dominant-color*`, `src/lib/anilist.ts` uncommitted része) érintetlenek maradnak. Csak backend/logika.
- **Script-konvenció:** `.mjs`, `process.env.DATABASE_URL`-t olvas (nem `.env.local`). Futtatás: `DATABASE_URL="..." node scripts/x.mjs`.
- **`title.anilistId` marad notNull**; az `anime` compat-view `.notNull()` tükrözését nem bántjuk (M1-lecke).
- **Tesztek:** pure-fn, vitest. `npm test` = `vitest run`. Egy fájl: `npx vitest run <path>`. Típus: `npx tsc --noEmit`. Lint: `npm run lint`.
- **Git:** új `feature/backend-hardening` ág; commit/push a useré (a plan commit-lépései lokálisak).
- **DB-migrációk:** raw-SQL `.mjs`, idempotens; a user futtatja Neon-branchen dry-run után. Drizzle `schema.ts` a típusokhoz frissül.
- **AI-hibaüzenet:** felhasználónak fix, barátságos magyar szöveg; a nyers hiba csak `console.error`-ba (ne szivárogjon stack).

---

## Setup (Task 0)

- [ ] **Step 1: Új ág a jelenlegi HEAD-ről, design-fájlok érintése nélkül**

```bash
cd "/c/Users/konig/OneDrive/Dokumentumok/GitHub/anime-graph"
git checkout -b feature/backend-hardening
```

Az uncommitted design-változások a working-tree-ben maradnak; nem `git add`-eljük őket egyik taszkban sem (mindig explicit fájllistával commitolunk).

- [ ] **Step 2: Baseline zöld**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: minden zöld (a spec+plan doksik untrackedek, nem törik a buildet).

---

## PHASE A — WS3: Publikus link biztonsági audit (nincs migráció)

### Task A1: `toPublicAnime` fehérlista-szerializáló

A `/api/public/[token]` MÁR csak biztonságos mezőt map-el, de a whitelist inline van → egy jövőbeli edit szivárogtathat. Kiemeljük tesztelhető pure-fn-be, és a route ezt használja.

**Files:**
- Create: `src/lib/public-view.ts`
- Create: `src/lib/public-view.test.ts`
- Modify: `src/app/api/public/[token]/route.ts`

**Interfaces:**
- Produces: `toPublicAnime(row: PublicAnimeInput): PublicAnime` — csak `{ title, coverUrl, status, myScore, year }`.

- [ ] **Step 1: Failing test**

`src/lib/public-view.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toPublicAnime, PUBLIC_ANIME_KEYS } from './public-view'

describe('toPublicAnime', () => {
  it('csak a whitelist-mezőket adja vissza, a privát mezőket levágja', () => {
    const row = {
      titleRomaji: 'Steins;Gate', coverUrl: 'c.jpg', status: 'completed',
      myScore: 10, year: 2011,
      // privát/szivárgó mezők, amiknek SOHA nem szabad kimenniük:
      rawText: 'a titkos véleményem', description: 'hosszú leírás',
      tasteMemory: [{ text: 'like time-travel' }], userId: 1, id: 42,
    }
    const out = toPublicAnime(row as never)
    expect(Object.keys(out).sort()).toEqual([...PUBLIC_ANIME_KEYS].sort())
    expect(out).toEqual({
      title: 'Steins;Gate', coverUrl: 'c.jpg', status: 'completed', myScore: 10, year: 2011,
    })
    // explicit tiltás:
    for (const leaked of ['rawText', 'description', 'tasteMemory', 'userId', 'id']) {
      expect(out).not.toHaveProperty(leaked)
    }
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/public-view.test.ts`
Expected: FAIL — `Cannot find module './public-view'`.

- [ ] **Step 3: Implementáció**

`src/lib/public-view.ts`:
```ts
// A publikus (jelszó nélküli) nézetbe SOHA nem mehet vélemény-szöveg,
// ízlés-memória vagy privát opinion-adat. Ez a fehérlista a kizárólagos kapu.
export const PUBLIC_ANIME_KEYS = ['title', 'coverUrl', 'status', 'myScore', 'year'] as const

export type PublicAnime = {
  title: string
  coverUrl: string | null
  status: string
  myScore: number | null
  year: number | null
}

export type PublicAnimeInput = {
  titleRomaji: string
  coverUrl: string | null
  status: string
  myScore: number | null
  year: number | null
}

export function toPublicAnime(row: PublicAnimeInput): PublicAnime {
  return {
    title: row.titleRomaji,
    coverUrl: row.coverUrl,
    status: row.status,
    myScore: row.myScore,
    year: row.year,
  }
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/public-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Route átkötése a szerializálóra**

`src/app/api/public/[token]/route.ts` — az `anime: rows.sort(...).map((a) => ({...}))` blokkot cseréld:
```ts
import { toPublicAnime } from '@/lib/public-view'
// ...
    anime: rows
      .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))
      .map(toPublicAnime),
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/lib/public-view.test.ts`
Expected: minden zöld.

```bash
git add src/lib/public-view.ts src/lib/public-view.test.ts "src/app/api/public/[token]/route.ts"
git commit -m "feat(security): whitelist serializer for public token view + regression test"
```

- [ ] **Step 7: Manuális audit-checklist (a spec Security checklistje)**

Nézd át `src/app/p/[token]/page.tsx`-et: csak a `/api/public/[token]` endpointot hívja-e (más user-scoped API-t NEM). Ha más endpointot is hív, azt is auditáld ugyanígy. Jegyezd a PR-leírásba: „`/p/[token]` csak a publikus endpointot fogyasztja — igazolva".

---

## PHASE B — WS4: Core loop stabilizáció (nincs migráció)

### Task B1: Barátságos AI-hibaüzenet (stack-leak fix)

`recommend` és `vibe` route `catch`-e most `String(e)`-t ad vissza a kliensnek → stack/belső infó szivárog. Pure-fn a felhasználói üzenetre.

**Files:**
- Create: `src/lib/ai-error.ts`
- Create: `src/lib/ai-error.test.ts`
- Modify: `src/app/api/recommend/route.ts`, `src/app/api/vibe/route.ts`

**Interfaces:**
- Produces: `aiUserErrorMessage(e: unknown): string`

- [ ] **Step 1: Failing test**

`src/lib/ai-error.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { aiUserErrorMessage } from './ai-error'

describe('aiUserErrorMessage', () => {
  it('napi limitnél a limit-üzenetet adja vissza', () => {
    expect(aiUserErrorMessage(new Error('Elérted a napi AI-keretet (5 hívás) — holnap folytathatod')))
      .toContain('napi AI-keretet')
  })
  it('minden más hibánál általános üzenet, NEM a nyers hiba', () => {
    const msg = aiUserErrorMessage(new Error('ECONNREFUSED 10.0.0.1:443 stacktrace...'))
    expect(msg).not.toContain('ECONNREFUSED')
    expect(msg).toContain('nem elérhető')
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/ai-error.test.ts`
Expected: FAIL — modul hiányzik.

- [ ] **Step 3: Implementáció**

`src/lib/ai-error.ts`:
```ts
// A kliensnek fix, barátságos üzenet megy — a nyers hibát a hívó console.error-ozza.
export function aiUserErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  // a kvóta-hibát változatlanul átengedjük (ez felhasználó-barát és informatív)
  if (raw.includes('napi AI-keretet') || raw.includes('napi limitjén')) return raw
  return 'Az AI most nem elérhető, próbáld újra pár perc múlva'
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/ai-error.test.ts`
Expected: PASS.

- [ ] **Step 5: recommend route catch cseréje**

`src/app/api/recommend/route.ts` — a záró catch:
```ts
import { aiUserErrorMessage } from '@/lib/ai-error'
// ...
  } catch (e) {
    console.error('recommend failed:', e)
    return NextResponse.json({ error: aiUserErrorMessage(e) }, { status: 502 })
  }
```

- [ ] **Step 6: vibe route catch cseréje**

`src/app/api/vibe/route.ts` — a záró catch ugyanígy:
```ts
import { aiUserErrorMessage } from '@/lib/ai-error'
// ...
  } catch (e) {
    console.error('vibe failed:', e)
    return NextResponse.json({ error: aiUserErrorMessage(e) }, { status: 502 })
  }
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/lib/ai-error.test.ts`
Expected: zöld.

```bash
git add src/lib/ai-error.ts src/lib/ai-error.test.ts src/app/api/recommend/route.ts src/app/api/vibe/route.ts
git commit -m "fix(core): friendly AI error message, stop leaking raw errors to client"
```

### Task B2: Wrapped üres-lista guard

0 anime / 0 epizód / nincs adott évi adat esetén a `/api/wrapped` NE dobjon — `buildWrapped` definit, nullázott struktúrát adjon.

**Files:**
- Modify: `src/lib/wrapped.ts` (csak ha a teszt bukik)
- Modify: `src/lib/wrapped.test.ts`

**Interfaces:**
- Consumes: `buildWrapped(anime, episodes, favchars, year)`, `availableYears(anime, episodes)` (meglévő).

- [ ] **Step 1: Failing/characterization test hozzáadása**

`src/lib/wrapped.test.ts` — új teszt a fájl végére:
```ts
import { describe, it, expect } from 'vitest'
import { buildWrapped, availableYears } from './wrapped'

describe('wrapped — üres bemenet', () => {
  it('nem dob és definit struktúrát ad 0 animénél', () => {
    expect(() => buildWrapped([], [], [], new Date().getFullYear())).not.toThrow()
    const w = buildWrapped([], [], [], 2024)
    expect(w).toBeTruthy()
    // ne legyen NaN egyetlen szám-mezőben sem
    for (const v of Object.values(w)) {
      if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false)
    }
  })
  it('availableYears üres bemenetre üres tömb', () => {
    expect(availableYears([], [])).toEqual([])
  })
})
```

- [ ] **Step 2: Fut**

Run: `npx vitest run src/lib/wrapped.test.ts`
Expected: vagy PASS (buildWrapped már robusztus → nincs kód-változás, ugorj Step 5-re), vagy FAIL (NaN/throw → Step 3).

- [ ] **Step 3: Guard beépítése (csak ha Step 2 bukott)**

`src/lib/wrapped.ts` — a NaN-t okozó osztásokat védd `denominator || 1`-gyel, és minden aggregátum-kezdőérték `0`/`[]`/`null`. Konkrét példa (a tényleges osztás helyén, pl. átlag-számítás):
```ts
const avgScore = scored.length ? sum / scored.length : 0
```
Alkalmazd minden `/ n` és `arr[0]` mintára, ahol `n` lehet 0 vagy `arr` üres.

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/wrapped.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: zöld.

```bash
git add src/lib/wrapped.ts src/lib/wrapped.test.ts
git commit -m "fix(core): wrapped handles empty list without NaN/crash"
```

---

## PHASE C — WS2: Réteges AI-kvóta + költség-log (migráció)

### Task C1: Költség-becslő pure-fn + ár-konfig

**Files:**
- Create: `src/lib/ai-cost.ts`
- Create: `src/lib/ai-cost.test.ts`

**Interfaces:**
- Produces: `AI_COST_PER_1K_TOKENS`, `estimateCost(model: string, promptTok: number, completionTok: number): number`

- [ ] **Step 1: Failing test**

`src/lib/ai-cost.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { estimateCost } from './ai-cost'

describe('estimateCost', () => {
  it('ingyen modellnél 0', () => {
    expect(estimateCost('glm-4.7-flash', 1000, 1000)).toBe(0)
  })
  it('ismeretlen modellnél 0 (nem dob)', () => {
    expect(estimateCost('valami-ismeretlen', 1000, 500)).toBe(0)
  })
  it('árazott modellnél token-arányos', () => {
    // 2000 prompt + 1000 completion @ 0.001/1k prompt, 0.002/1k completion = 0.002 + 0.002
    expect(estimateCost('__test-paid', 2000, 1000)).toBeCloseTo(0.004)
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/ai-cost.test.ts`
Expected: FAIL — modul hiányzik.

- [ ] **Step 3: Implementáció**

`src/lib/ai-cost.ts`:
```ts
// USD / 1000 token. A free tier most 0 — de a tokent MÉGIS logoljuk (WS2),
// hogy paid-modellre váltáskor a historikus volumen valós költséget vetítsen.
export const AI_COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  'glm-4.7-flash': { prompt: 0, completion: 0 },
  'deepseek/deepseek-chat-v3-0324:free': { prompt: 0, completion: 0 },
  // jövőbeli fizetős modell ára ide, pl.:
  // 'glm-4-plus': { prompt: 0.001, completion: 0.001 },
  '__test-paid': { prompt: 0.001, completion: 0.002 }, // csak teszthez
}

export function estimateCost(model: string, promptTok: number, completionTok: number): number {
  const price = AI_COST_PER_1K_TOKENS[model]
  if (!price) return 0
  return (promptTok / 1000) * price.prompt + (completionTok / 1000) * price.completion
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/ai-cost.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-cost.ts src/lib/ai-cost.test.ts
git commit -m "feat(quota): AI cost estimation config + helper"
```

### Task C2: Tier + endpoint limit-feloldó pure-fn

**Files:**
- Create: `src/lib/ai-limits.ts`
- Create: `src/lib/ai-limits.test.ts`

**Interfaces:**
- Produces: `AI_LIMITS`, `resolveLimit(endpoint: string, tier: 'free' | 'paid'): number`

- [ ] **Step 1: Failing test**

`src/lib/ai-limits.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveLimit } from './ai-limits'

describe('resolveLimit', () => {
  it('ismert endpoint + free', () => { expect(resolveLimit('recommend', 'free')).toBe(5) })
  it('ismert endpoint + paid', () => { expect(resolveLimit('recommend', 'paid')).toBe(50) })
  it('vibe free', () => { expect(resolveLimit('vibe', 'free')).toBe(10) })
  it('ismeretlen endpoint a default limitre esik', () => {
    expect(resolveLimit('digest', 'free')).toBe(20)
    expect(resolveLimit('digest', 'paid')).toBe(200)
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/ai-limits.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementáció**

`src/lib/ai-limits.ts`:
```ts
export type Tier = 'free' | 'paid'

export const AI_LIMITS: Record<string, { free: number; paid: number }> = {
  recommend: { free: 5, paid: 50 },
  vibe: { free: 10, paid: 100 },
  default: { free: 20, paid: 200 },
}

export function resolveLimit(endpoint: string, tier: Tier): number {
  const row = AI_LIMITS[endpoint] ?? AI_LIMITS.default
  return row[tier]
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/ai-limits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-limits.ts src/lib/ai-limits.test.ts
git commit -m "feat(quota): tiered per-endpoint AI limit resolver"
```

### Task C3: Séma — `users.tier` + `ai_usage_log` + migráció

**Files:**
- Modify: `src/db/schema.ts`
- Create: `scripts/migrate-ai-tier-usage.mjs`

**Interfaces:**
- Produces: `aiUsageLog` tábla-objektum, `users.tier` oszlop.

- [ ] **Step 1: Drizzle séma — `users.tier`**

`src/db/schema.ts` — a `users` táblához:
```ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  tier: text('tier').notNull().default('free'), // free | paid
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

- [ ] **Step 2: Drizzle séma — `ai_usage_log`**

`src/db/schema.ts` — új tábla (a `recommendations` után):
```ts
// minden AI-hívás egy sor — a valós költség-visszamérés alapja árazás előtt
export const aiUsageLog = pgTable('ai_usage_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  estCostUsd: real('est_cost_usd').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('ai_usage_user_day').on(t.userId, t.createdAt),
])
```

- [ ] **Step 3: Migrációs script (idempotens raw SQL)**

`scripts/migrate-ai-tier-usage.mjs`:
```js
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'`
  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      endpoint text NOT NULL,
      model text NOT NULL,
      prompt_tokens integer NOT NULL DEFAULT 0,
      completion_tokens integer NOT NULL DEFAULT 0,
      est_cost_usd real NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  await sql`CREATE INDEX IF NOT EXISTS ai_usage_user_day ON ai_usage_log (user_id, created_at)`
  console.log('migrate-ai-tier-usage: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 4: Verify (típus + lint)**

Run: `npx tsc --noEmit && npm run lint`
Expected: zöld (a séma-típusok fordulnak; DB-futtatás a useré).

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts scripts/migrate-ai-tier-usage.mjs
git commit -m "feat(quota): schema + migration for users.tier and ai_usage_log"
```

### Task C4: `consumeAiQuota` tier-aware + `glmChat` usage-log bekötés

**Files:**
- Modify: `src/lib/ai-quota.ts`
- Modify: `src/lib/glm.ts`
- Modify: `src/app/api/recommend/route.ts`, `src/app/api/vibe/route.ts`

**Interfaces:**
- Consumes: `resolveLimit`, `estimateCost`.
- Produces: `consumeAiQuota(userId: number, endpoint: string): Promise<void>`; `glmChat(messages, opts?: { retries?, userId?, endpoint? })`.

- [ ] **Step 1: `consumeAiQuota` átírás (tier + endpoint)**

`src/lib/ai-quota.ts` teljes tartalma:
```ts
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { settings, users } from '@/db/schema'
import { resolveLimit, type Tier } from './ai-limits'

// közös AI-kulcs, fejenkénti + endpointonkénti napi sapka a tier szerint
export async function consumeAiQuota(userId: number, endpoint: string): Promise<void> {
  const [u] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId))
  const tier: Tier = u?.tier === 'paid' ? 'paid' : 'free'
  const envCap = Number(process.env.AI_DAILY_LIMIT ?? 0)
  const limit = envCap > 0 ? Math.min(envCap, resolveLimit(endpoint, tier)) : resolveLimit(endpoint, tier)

  const day = new Date().toISOString().slice(0, 10)
  const key = `aiDay:${day}:${endpoint}`
  const [row] = await db.select().from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
  const count = row ? Number((row.value as { count?: number }).count ?? 0) : 0
  if (count >= limit) {
    throw new Error(`Elérted a napi AI-keretet (${limit} hívás) — holnap folytathatod`)
  }
  await db.insert(settings)
    .values({ userId, key, value: { count: 1 } })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: sql`jsonb_build_object('count', coalesce((${settings.value}->>'count')::int, 0) + 1)` },
    })
}
```

- [ ] **Step 2: `glmChat` — usage-log + endpoint/userId opció**

`src/lib/glm.ts` — a signature és a sikeres-ág bővítése (a retry/fallback logika változatlan):
```ts
import { db } from '@/db/client'
import { aiUsageLog } from '@/db/schema'
import { estimateCost } from './ai-cost'

export type GlmOpts = { retries?: number; userId?: number; endpoint?: string }

async function logUsage(model: string, usage: unknown, opts: GlmOpts, contentLen: number) {
  if (opts.userId == null || !opts.endpoint) return
  const u = (usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number }
  // ha az API nem ad usage-t, becslés ~4 char/token, hogy sose 0 legyen ha volt válasz
  const prompt = u.prompt_tokens ?? 0
  const completion = u.completion_tokens ?? Math.ceil(contentLen / 4)
  try {
    await db.insert(aiUsageLog).values({
      userId: opts.userId, endpoint: opts.endpoint, model,
      promptTokens: prompt, completionTokens: completion,
      estCostUsd: estimateCost(model, prompt, completion),
    })
  } catch (e) {
    console.error('ai_usage_log insert failed:', e) // a logolás sose bukjon el a fő hívást
  }
}
```
A `glmChat` signature: `export async function glmChat(messages: ChatMessage[], opts: GlmOpts = {})`. A `const { retries = 3 } = opts`. A GLM sikeres visszatérés ELŐTT (a `return content` helyett):
```ts
      await logUsage(MODEL, json?.usage, opts, content.length)
      return content
```
Az `openRouterChat`-et is bővítsd `opts`-szal, és a sikeres ág előtt: `await logUsage(orModel, json?.usage, opts, content.length)` (ahol `orModel` a használt modell-string). Az `openRouterChat(messages)` hívást a fallbackben cseréld `openRouterChat(messages, opts)`-ra.

- [ ] **Step 3: recommend route — endpoint átadása**

`src/app/api/recommend/route.ts`:
```ts
    await consumeAiQuota(userId, 'recommend')
    const raw = await glmChat(
      buildRecommendMessages(ranked, facts, top.map((t) => t.titleRomaji), extras),
      { userId, endpoint: 'recommend' },
    )
```

- [ ] **Step 4: vibe route — endpoint átadása**

`src/app/api/vibe/route.ts`:
```ts
    await consumeAiQuota(userId, 'vibe')
    const raw = await glmChat(
      buildVibeMessages(prompt || 'a kiválasztott animékhez hasonlót keresek', own, globalFacts),
      { userId, endpoint: 'vibe' },
    )
```

- [ ] **Step 5: Többi `consumeAiQuota` hívó javítása**

Run: `npx tsc --noEmit`
Expected: FAIL azoknál a route-oknál, amik még 1-argumentummal hívják `consumeAiQuota`-t (pl. `digest`, `nl-search`, `season-scores`, `taste/eras`, `profile`, `duo`). Mindegyiknél add meg a második argumentumot a saját endpoint-nevével (pl. `consumeAiQuota(userId, 'digest')`) és a `glmChat`-nek is a `{ userId, endpoint }` opciót. Ismételd, míg `tsc` zöld.

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: minden zöld.

```bash
git add src/lib/ai-quota.ts src/lib/glm.ts src/app/api
git commit -m "feat(quota): tier-aware quota + per-call AI usage logging"
```

---

## PHASE D — WS1: offline-db → `title` migráció (migráció, legnagyobb)

### Task D1: `mapOfflineEntry` pure-fn

**Files:**
- Create: `src/lib/offline-db.ts`
- Create: `src/lib/offline-db.test.ts`

**Interfaces:**
- Produces: `parseAnilistId(sources: string[]): number | null`, `parseMalId(sources: string[]): number | null`, `mapOfflineEntry(entry): MappedTitle | null` (null ha nincs AniList-source).

- [ ] **Step 1: Failing test**

`src/lib/offline-db.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseAnilistId, parseMalId, mapOfflineEntry } from './offline-db'

const entry = {
  sources: ['https://anilist.co/anime/5114', 'https://myanimelist.net/anime/5114'],
  title: 'Fullmetal Alchemist: Brotherhood',
  type: 'TV', episodes: 64, status: 'FINISHED',
  animeSeason: { season: 'SPRING', year: 2009 },
  picture: 'https://cdn/pic.jpg',
  duration: { value: 1440, unit: 'SECONDS' },
  score: { median: 9.1 },
  studios: ['bones'],
  relatedAnime: ['https://anilist.co/anime/9135'],
  tags: ['action', 'military'],
}

describe('parseAnilistId / parseMalId', () => {
  it('kinyeri az AniList és MAL id-t a sources-ból', () => {
    expect(parseAnilistId(entry.sources)).toBe(5114)
    expect(parseMalId(entry.sources)).toBe(5114)
  })
  it('null ha nincs olyan source', () => {
    expect(parseAnilistId(['https://myanimelist.net/anime/1'])).toBeNull()
  })
})

describe('mapOfflineEntry', () => {
  it('AniList-source nélkül null (MAL-only kimarad)', () => {
    expect(mapOfflineEntry({ ...entry, sources: ['https://myanimelist.net/anime/1'] })).toBeNull()
  })
  it('leképez title-oszlopokra, score.median → avgScore ×10', () => {
    const m = mapOfflineEntry(entry)!
    expect(m.anilistId).toBe(5114)
    expect(m.malId).toBe(5114)
    expect(m.titleRomaji).toBe('Fullmetal Alchemist: Brotherhood')
    expect(m.coverUrl).toBe('https://cdn/pic.jpg')
    expect(m.episodes).toBe(64)
    expect(m.season).toBe('SPRING')
    expect(m.year).toBe(2009)
    expect(m.studio).toBe('bones')
    expect(m.avgScore).toBe(91)
    expect(m.durationMin).toBe(24)
    expect(m.relations).toEqual([{ type: 'RELATED', anilistId: 9135, title: '' }])
    expect(m.tags.map((t) => t.name)).toContain('action')
  })
  it('hiányzó animeSeason/score/studios nem dob', () => {
    const m = mapOfflineEntry({ ...entry, animeSeason: undefined, score: undefined, studios: [] })!
    expect(m.season).toBeNull()
    expect(m.year).toBeNull()
    expect(m.avgScore).toBeNull()
    expect(m.studio).toBeNull()
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/offline-db.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementáció**

`src/lib/offline-db.ts`:
```ts
import type { RelationEntry, TagEntry } from '@/db/schema'

export type OfflineEntry = {
  sources: string[]
  title: string
  type?: string
  episodes?: number
  animeSeason?: { season?: string; year?: number }
  picture?: string
  duration?: { value?: number; unit?: string }
  score?: { median?: number }
  studios?: string[]
  relatedAnime?: string[]
  tags?: string[]
}

export type MappedTitle = {
  anilistId: number
  malId: number | null
  titleRomaji: string
  coverUrl: string | null
  episodes: number | null
  season: string | null
  year: number | null
  studio: string | null
  durationMin: number | null
  avgScore: number | null
  genres: string[]
  tags: TagEntry[]
  relations: RelationEntry[]
}

const idFrom = (sources: string[], host: string): number | null => {
  for (const s of sources) {
    const m = s.match(new RegExp(`${host}/anime/(\\d+)`))
    if (m) return Number(m[1])
  }
  return null
}
export const parseAnilistId = (sources: string[]) => idFrom(sources, 'anilist\\.co')
export const parseMalId = (sources: string[]) => idFrom(sources, 'myanimelist\\.net')

// az AniList „genre" egy zárt, kis halmaz — az offline-db tag-jei közül csak ezek genre-k
const KNOWN_GENRES = new Set([
  'action', 'adventure', 'comedy', 'drama', 'ecchi', 'fantasy', 'horror', 'mahou shoujo',
  'mecha', 'music', 'mystery', 'psychological', 'romance', 'sci-fi', 'slice of life',
  'sports', 'supernatural', 'thriller',
])

export function mapOfflineEntry(entry: OfflineEntry): MappedTitle | null {
  const anilistId = parseAnilistId(entry.sources)
  if (anilistId == null) return null
  const tags = entry.tags ?? []
  const durSec = entry.duration?.unit === 'SECONDS' ? entry.duration?.value : undefined
  const relations: RelationEntry[] = (entry.relatedAnime ?? [])
    .map((u) => parseAnilistId([u]))
    .filter((id): id is number => id != null)
    .map((id) => ({ type: 'RELATED', anilistId: id, title: '' }))
  return {
    anilistId,
    malId: parseMalId(entry.sources),
    titleRomaji: entry.title,
    coverUrl: entry.picture ?? null,
    episodes: entry.episodes ?? null,
    season: entry.animeSeason?.season ?? null,
    year: entry.animeSeason?.year ?? null,
    studio: entry.studios?.[0] ?? null,
    durationMin: durSec ? Math.round(durSec / 60) : null,
    avgScore: entry.score?.median != null ? Math.round(entry.score.median * 10) : null,
    genres: tags.filter((t) => KNOWN_GENRES.has(t.toLowerCase())),
    tags: tags.map((name) => ({ name, rank: 0 })),
    relations,
  }
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/offline-db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline-db.ts src/lib/offline-db.test.ts
git commit -m "feat(catalog): offline-db entry mapper (AniList-id gated, selective fields)"
```

### Task D2: `import-offline-db.mjs` script

**Files:**
- Create: `scripts/import-offline-db.mjs`

**Interfaces:**
- Consumes: a `mapOfflineEntry` logikát (a scriptben JS-ként duplikálva — a `.mjs` nem importál TS-t; a mapper-logika egyszerű, a pure-fn tesztje fedi a szabályt).

- [ ] **Step 1: Script megírása**

`scripts/import-offline-db.mjs`:
```js
import { neon } from '@neondatabase/serverless'

const DB_URL = 'https://raw.githubusercontent.com/manami-project/anime-offline-database/master/anime-offline-database-minified.json'
const sql = neon(process.env.DATABASE_URL)

const idFrom = (sources, host) => {
  for (const s of sources) { const m = s.match(new RegExp(`${host}/anime/(\\d+)`)); if (m) return Number(m[1]) }
  return null
}
const KNOWN_GENRES = new Set(['action','adventure','comedy','drama','ecchi','fantasy','horror','mahou shoujo','mecha','music','mystery','psychological','romance','sci-fi','slice of life','sports','supernatural','thriller'])

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
      // SZELEKTÍV upsert: volatilis meta felülíródik; description/relations(ha van)/avgScore(ha van)/
      // communityScore/popularity/trailer/banner MARAD az AniList-enrichmenté.
      const res2 = await sql`
        INSERT INTO title (anilist_id, media_type, slug, title_romaji, cover_url, episodes,
          season, year, studio, duration_min, avg_score, genres, tags, relations, mal_id, synced_at)
        VALUES (${r.anilistId}, 'ANIME', ${r.slug}, ${r.titleRomaji}, ${r.coverUrl}, ${r.episodes},
          ${r.season}, ${r.year}, ${r.studio}, ${r.durationMin}, ${r.avgScore},
          ${r.genres}, ${JSON.stringify(r.tags)}, ${JSON.stringify(r.relations)}, ${r.malId}, now())
        ON CONFLICT (anilist_id, media_type) DO UPDATE SET
          cover_url = excluded.cover_url,
          episodes = excluded.episodes,
          season = excluded.season,
          year = excluded.year,
          duration_min = excluded.duration_min,
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
```

- [ ] **Step 2: Verify (lint — a script node-lint alá esik-e; ha az eslint config nem fedi a scripts/-et, csak szintaxis-ellenőrzés)**

Run: `node --check scripts/import-offline-db.mjs`
Expected: nincs kimenet (szintaktikailag OK). DB-futtatás a useré (Neon-branch dry-run).

- [ ] **Step 3: Commit**

```bash
git add scripts/import-offline-db.mjs
git commit -m "feat(catalog): offline-db import script with selective title upsert"
```

### Task D3: Lokális rec-pool pure-fn + recommend route repoint

Kiváltja a `fetchRecommendationsFor` élő AniList-hívást a `title` katalógusból épített jelöltlistával.

**Files:**
- Create: `src/lib/local-candidates.ts`
- Create: `src/lib/local-candidates.test.ts`
- Modify: `src/app/api/recommend/route.ts`

**Interfaces:**
- Produces: `buildLocalCandidates(favorites: FavInput[], catalog: CatalogRow[], ownedAnilistIds: Set<number>, limit?: number): RecCandidate[]`
- Consumes: `RecCandidate` (`src/lib/anilist.ts`), `genreWeights`/`rankCandidates` (`src/lib/candidates.ts`) — a route továbbra is ezekkel rangsorol.

- [ ] **Step 1: Failing test**

`src/lib/local-candidates.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildLocalCandidates } from './local-candidates'

const cat = (anilistId: number, genres: string[], communityScore: number | null, avgScore: number | null, relations: number[] = []) => ({
  anilistId, titleRomaji: `T${anilistId}`, coverUrl: null, genres,
  communityScore, avgScore,
  relations: relations.map((id) => ({ type: 'RELATED', anilistId: id, title: '' })),
})

describe('buildLocalCandidates', () => {
  const catalog = [
    cat(10, ['Action'], 8.5, 80),
    cat(11, ['Action', 'Drama'], 7.0, 75),
    cat(12, ['Romance'], 9.0, 90),
    cat(13, ['Action'], null, 60),
  ]
  it('a kedvencek relations-ét és azonos-genre címeit hozza, owned kizárva', () => {
    const favorites = [{ anilistId: 99, genres: ['Action'], relations: [11] }]
    const out = buildLocalCandidates(favorites, catalog, new Set([10]))
    const ids = out.map((c) => c.anilistId)
    expect(ids).toContain(11)   // relation ÉS azonos genre
    expect(ids).toContain(13)   // azonos genre
    expect(ids).not.toContain(10) // owned
    expect(ids).not.toContain(99) // maga a kedvenc (nincs is a katalógusban itt)
  })
  it('RecCandidate alakot ad (anilistId,title,coverUrl,genres,avgScore)', () => {
    const out = buildLocalCandidates([{ anilistId: 1, genres: ['Romance'], relations: [] }], catalog, new Set())
    expect(out[0]).toHaveProperty('anilistId')
    expect(out[0]).toHaveProperty('genres')
    expect(out[0]).toHaveProperty('avgScore')
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/local-candidates.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementáció**

`src/lib/local-candidates.ts`:
```ts
import type { RecCandidate } from './anilist'

export type FavInput = { anilistId: number; genres: string[]; relations: { anilistId: number }[] | number[] }
export type CatalogRow = {
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  communityScore: number | null
  avgScore: number | null
  relations: { anilistId: number }[]
}

// Lokális jelöltlista a `title` katalógusból — kiváltja az élő AniList „recommendations" hívást.
// Jelöltek: a kedvencek relations ID-i + a kedvenc-genre-ökkel átfedő címek, minőség szerint.
export function buildLocalCandidates(
  favorites: FavInput[],
  catalog: CatalogRow[],
  ownedAnilistIds: Set<number>,
  limit = 200,
): RecCandidate[] {
  const relIds = new Set<number>()
  for (const f of favorites) {
    for (const r of f.relations as Array<number | { anilistId: number }>) {
      relIds.add(typeof r === 'number' ? r : r.anilistId)
    }
  }
  const favGenres = new Set(favorites.flatMap((f) => f.genres))
  const favAnilist = new Set(favorites.map((f) => f.anilistId))

  const scored = catalog
    .filter((c) => !ownedAnilistIds.has(c.anilistId) && !favAnilist.has(c.anilistId))
    .map((c) => {
      const genreOverlap = c.genres.filter((g) => favGenres.has(g)).length
      const isRelation = relIds.has(c.anilistId) ? 1 : 0
      if (genreOverlap === 0 && !isRelation) return null
      const quality = c.communityScore ?? (c.avgScore != null ? c.avgScore / 10 : 6)
      return { c, key: isRelation * 100 + genreOverlap * 5 + quality }
    })
    .filter((x): x is { c: CatalogRow; key: number } => x !== null)
    .sort((a, b) => b.key - a.key)
    .slice(0, limit)

  return scored.map(({ c }): RecCandidate => ({
    anilistId: c.anilistId,
    title: c.titleRomaji,
    coverUrl: c.coverUrl,
    genres: c.genres,
    avgScore: c.avgScore,
  }))
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/local-candidates.test.ts`
Expected: PASS.

- [ ] **Step 5: recommend route repoint (AniList pool → lokális pool)**

`src/app/api/recommend/route.ts` — a `title` táblát is importáld (`import { anime, title, tasteMemory, recommendations } from '@/db/schema'`), és a `pools`/`candidates` blokkot (a `fetchRecommendationsFor`-os rész) cseréld:
```ts
import { buildLocalCandidates } from '@/lib/local-candidates'
// ...
  const favorites = top.map((t) => ({
    anilistId: t.anilistId, genres: t.genres,
    relations: (t.relations ?? []).map((r) => r.anilistId),
  }))
  const catalog = await db.select({
    anilistId: title.anilistId, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
    genres: title.genres, communityScore: title.communityScore, avgScore: title.avgScore,
    relations: title.relations,
  }).from(title).where(eq(title.mediaType, 'ANIME'))
  const owned = new Set(rows.map((r) => r.anilistId))
  const candidates = buildLocalCandidates(favorites, catalog, owned)
  if (!candidates.length) {
    return NextResponse.json({ error: 'Nincs elég katalógus-adat az ajánláshoz' }, { status: 502 })
  }
```
Töröld a `fetchRecommendationsFor` importot és a `Promise.allSettled(top.map(...))` blokkot. A `weights = genreWeights(rows)` és `ranked = rankCandidates(candidates, owned, weights, 30)` marad. (Megjegyzés: a `title.relations` a szelektív upsert miatt lehet üres a friss soroknál — a genre-átfedés akkor is ad jelöltet.)

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: zöld.

```bash
git add src/lib/local-candidates.ts src/lib/local-candidates.test.ts src/app/api/recommend/route.ts
git commit -m "feat(catalog): local recommendation pool from title catalog (drop live AniList recs)"
```

### Task D4: `title_recommendations` cache + batch-sync (kollaboratív jel megőrzése)

A jóváhagyott középút: az AniList „recommendations" jel NEM tűnik el, hanem heti batch-ben cache-elődik, és a rec-pool beemeli.

**Files:**
- Modify: `src/db/schema.ts`
- Create: `scripts/sync-title-recs.mjs`
- Modify: `scripts/migrate-catalog-cache.mjs` (lásd Task D8 — ott jön létre a WS1 táblák migrációja)
- Modify: `src/lib/local-candidates.ts` (recIds beemelése)
- Modify: `src/lib/local-candidates.test.ts`
- Modify: `src/app/api/recommend/route.ts`

**Interfaces:**
- Produces: `titleRecommendations` tábla; `buildLocalCandidates(..., recIds?: Set<number>)` bővített aláírás.

- [ ] **Step 1: Séma**

`src/db/schema.ts`:
```ts
// AniList "users who liked X" jel, batch-cache-elve (heti sync) — nem élő per-request
export const titleRecommendations = pgTable('title_recommendations', {
  id: serial('id').primaryKey(),
  anilistId: integer('anilist_id').notNull(),       // a forrás-cím
  recAnilistId: integer('rec_anilist_id').notNull(), // az ajánlott cím
  rating: integer('rating').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('title_rec_unique').on(t.anilistId, t.recAnilistId),
])
```

- [ ] **Step 2: `buildLocalCandidates` — recIds beemelése (test előbb)**

`src/lib/local-candidates.test.ts` — új teszt:
```ts
it('a batch-cache-elt recIds is jelölt (relation-szintű súllyal)', () => {
  const catalog = [
    { anilistId: 20, titleRomaji: 'T20', coverUrl: null, genres: ['Mystery'], communityScore: null, avgScore: 70, relations: [] },
  ]
  const out = buildLocalCandidates([{ anilistId: 1, genres: [], relations: [] }], catalog, new Set(), 200, new Set([20]))
  expect(out.map((c) => c.anilistId)).toContain(20)
})
```

- [ ] **Step 3: `buildLocalCandidates` bővítés**

`src/lib/local-candidates.ts` — a signature-höz `recIds: Set<number> = new Set()`, és a scoring:
```ts
export function buildLocalCandidates(
  favorites: FavInput[],
  catalog: CatalogRow[],
  ownedAnilistIds: Set<number>,
  limit = 200,
  recIds: Set<number> = new Set(),
): RecCandidate[] {
  // ... a relIds/favGenres/favAnilist változatlan ...
    .map((c) => {
      const genreOverlap = c.genres.filter((g) => favGenres.has(g)).length
      const isRelation = relIds.has(c.anilistId) ? 1 : 0
      const isRec = recIds.has(c.anilistId) ? 1 : 0
      if (genreOverlap === 0 && !isRelation && !isRec) return null
      const quality = c.communityScore ?? (c.avgScore != null ? c.avgScore / 10 : 6)
      return { c, key: isRelation * 100 + isRec * 80 + genreOverlap * 5 + quality }
    })
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/local-candidates.test.ts`
Expected: PASS (mindkét teszt).

- [ ] **Step 5: recommend route — recIds betöltése**

`src/app/api/recommend/route.ts` — a `top` kedvencek anilistId-ire lekérdezi a cache-t:
```ts
import { titleRecommendations } from '@/db/schema'
import { inArray } from 'drizzle-orm'
// ... a favorites után:
  const topIds = top.map((t) => t.anilistId)
  const recRows = topIds.length
    ? await db.select({ recAnilistId: titleRecommendations.recAnilistId })
        .from(titleRecommendations).where(inArray(titleRecommendations.anilistId, topIds))
    : []
  const recIds = new Set(recRows.map((r) => r.recAnilistId))
  const candidates = buildLocalCandidates(favorites, catalog, owned, 200, recIds)
```

- [ ] **Step 6: Batch-sync script**

`scripts/sync-title-recs.mjs` — a katalógus címeire (vagy a `user_title`-ben szereplő anilistId-kra, hogy fókuszált legyen) lekéri az AniList recommendationst és upsertel. Rate-limit guard (90 req/min), 429-backoff:
```js
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
const Q = `query($id:Int){Media(id:$id,type:ANIME){recommendations(sort:RATING_DESC,perPage:10){nodes{rating mediaRecommendation{id}}}}}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchRecs(id) {
  for (let a = 0; a < 4; a++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: Q, variables: { id } }),
    })
    if (res.status === 429) { await sleep(60000); continue }
    if (!res.ok) return []
    const j = await res.json()
    return (j.data?.Media?.recommendations?.nodes ?? [])
      .filter((n) => n.mediaRecommendation?.id)
      .map((n) => ({ recAnilistId: n.mediaRecommendation.id, rating: n.rating ?? 0 }))
  }
  return []
}

async function main() {
  // csak a listákon szereplő címekre (fókuszált, nem a teljes 22k) — bővíthető
  const ids = (await sql`SELECT DISTINCT t.anilist_id FROM user_title ut JOIN title t ON t.id = ut.title_id WHERE t.media_type = 'ANIME'`).map((r) => r.anilist_id)
  console.log(`${ids.length} cím recs-szinkron`)
  let done = 0
  for (const id of ids) {
    const recs = await fetchRecs(id)
    for (const r of recs) {
      await sql`INSERT INTO title_recommendations (anilist_id, rec_anilist_id, rating)
        VALUES (${id}, ${r.recAnilistId}, ${r.rating})
        ON CONFLICT (anilist_id, rec_anilist_id) DO UPDATE SET rating = excluded.rating`
    }
    if (++done % 20 === 0) { console.log(`${done}/${ids.length}`); await sleep(700) }
    else await sleep(700) // ~85 req/min
  }
  console.log('sync-title-recs: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test && node --check scripts/sync-title-recs.mjs`
Expected: zöld.

```bash
git add src/db/schema.ts scripts/sync-title-recs.mjs src/lib/local-candidates.ts src/lib/local-candidates.test.ts src/app/api/recommend/route.ts
git commit -m "feat(catalog): batch-cached AniList recs (title_recommendations) feeding the local pool"
```

### Task D5: Browse a `title` katalógusból

**Files:**
- Create: `src/lib/browse-local.ts`
- Create: `src/lib/browse-local.test.ts`
- Modify: `src/app/api/browse/route.ts`

**Interfaces:**
- Produces: `buildBrowseOrder(sort): 'popularity' | 'score' | 'year'`, `browseTitles(db, filters): Promise<{ total, media }>` — de a tesztelhető rész a **rendezés/szűrő-leképezés pure-fn**; az SQL-t a route/lib végzi.

- [ ] **Step 1: Failing test (pure sort/filter map)**

`src/lib/browse-local.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { browseSortColumn } from './browse-local'

describe('browseSortColumn', () => {
  it('AniList-sort → title-oszlop', () => {
    expect(browseSortColumn('POPULARITY_DESC')).toBe('popularity')
    expect(browseSortColumn('SCORE_DESC')).toBe('score')
    expect(browseSortColumn('START_DATE_DESC')).toBe('year')
    expect(browseSortColumn('ismeretlen')).toBe('popularity') // default
  })
})
```

- [ ] **Step 2: Fut, elhasal**

Run: `npx vitest run src/lib/browse-local.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementáció**

`src/lib/browse-local.ts`:
```ts
import { and, desc, eq, ilike, sql, type SQL } from 'drizzle-orm'
import { title } from '@/db/schema'
import type { BrowseFilters } from './browse'

export function browseSortColumn(sort: string): 'popularity' | 'score' | 'year' {
  if (sort === 'SCORE_DESC') return 'score'
  if (sort === 'START_DATE_DESC') return 'year'
  return 'popularity'
}

export function browseWhere(f: BrowseFilters): SQL {
  const parts: SQL[] = [eq(title.mediaType, f.type)]
  if (f.genre) parts.push(sql`${f.genre} = ANY(${title.genres})`)
  if (f.format) parts.push(eq(title.format, f.format))
  if (f.year) parts.push(eq(title.year, f.year))
  if (f.minScore) parts.push(sql`coalesce(${title.communityScore} * 10, ${title.avgScore}, 0) >= ${f.minScore}`)
  if (f.search) parts.push(ilike(title.titleRomaji, `%${f.search}%`))
  return and(...parts)!
}

export function browseOrder(sort: string) {
  const col = browseSortColumn(sort)
  if (col === 'score') return desc(sql`coalesce(${title.communityScore} * 10, ${title.avgScore}, 0)`)
  if (col === 'year') return desc(sql`coalesce(${title.year}, 0)`)
  return desc(title.popularity)
}
```

- [ ] **Step 4: Zöld**

Run: `npx vitest run src/lib/browse-local.test.ts`
Expected: PASS.

- [ ] **Step 5: browse route repoint**

`src/app/api/browse/route.ts` — cseréld a `fetchBrowse`-os try-blokkot lokális query-re:
```ts
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { browseWhere, browseOrder } from '@/lib/browse-local'
import { sql } from 'drizzle-orm'
// ...
  try {
    const where = browseWhere(filters)
    const perPage = 30
    if (sp.get('random') === '1') {
      const [pick] = await db.select().from(title).where(where).orderBy(sql`random()`).limit(1)
      if (!pick) return NextResponse.json({ error: 'Nincs találat ezekkel a szűrőkkel' }, { status: 404 })
      return NextResponse.json({ media: [pick] })
    }
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(title).where(where)
    const media = await db.select().from(title).where(where)
      .orderBy(browseOrder(filters.sort)).limit(perPage).offset((filters.page - 1) * perPage)
    return NextResponse.json({ total, media })
  } catch (e) {
    console.error('browse failed:', e)
    return NextResponse.json({ error: 'A böngésző most nem elérhető' }, { status: 502 })
  }
```
(A `bongeszo` kliens a `media[]` mezőit fogyasztja — a `title` sorai a régi AniList-alakhoz hasonló mezőket adnak: `titleRomaji/coverUrl/genres/year/avgScore/format`. Ha a kliens más mezőnevet vár, a lib egy `toBrowseMedia(row)` mapperrel igazítható — ellenőrizd a `bongeszo/page.tsx` fogyasztását `tsc`-vel.)

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: zöld.

```bash
git add src/lib/browse-local.ts src/lib/browse-local.test.ts src/app/api/browse/route.ts
git commit -m "feat(catalog): browse reads from title catalog instead of live AniList"
```

### Task D6: `api_cache` + seasonal/airing cache a News-on

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/lib/api-cache.ts`
- Create: `src/lib/api-cache.test.ts`
- Modify: `src/app/api/news/route.ts`

**Interfaces:**
- Produces: `apiCache` tábla; `isFresh(expiresAt: Date | null, now: Date): boolean`; `getCached<T>(key)`, `setCached(key, value, ttlSec)`.

- [ ] **Step 1: Séma**

`src/db/schema.ts`:
```ts
// alacsony-frekvenciás külső hívások (seasonal/airing) TTL-cache-e
export const apiCache = pgTable('api_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 2: `isFresh` pure-fn teszt**

`src/lib/api-cache.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isFresh } from './api-cache'

describe('isFresh', () => {
  const now = new Date('2026-07-22T12:00:00Z')
  it('jövőbeli lejárat friss', () => {
    expect(isFresh(new Date('2026-07-22T13:00:00Z'), now)).toBe(true)
  })
  it('múltbeli lejárat lejárt', () => {
    expect(isFresh(new Date('2026-07-22T11:00:00Z'), now)).toBe(false)
  })
  it('null nem friss', () => { expect(isFresh(null, now)).toBe(false) })
})
```

- [ ] **Step 3: Fut, elhasal**

Run: `npx vitest run src/lib/api-cache.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementáció**

`src/lib/api-cache.ts`:
```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { apiCache } from '@/db/schema'

export function isFresh(expiresAt: Date | null, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() > now.getTime()
}

export async function getCached<T>(key: string): Promise<T | null> {
  const [row] = await db.select().from(apiCache).where(eq(apiCache.key, key))
  if (!row || !isFresh(row.expiresAt, new Date())) return null
  return row.value as T
}

export async function setCached(key: string, value: unknown, ttlSec: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSec * 1000)
  await db.insert(apiCache).values({ key, value, expiresAt, updatedAt: new Date() })
    .onConflictDoUpdate({ target: apiCache.key, set: { value, expiresAt, updatedAt: new Date() } })
}
```

- [ ] **Step 5: Zöld**

Run: `npx vitest run src/lib/api-cache.test.ts`
Expected: PASS.

- [ ] **Step 6: News route — seasonal napi, airing óránkénti cache**

`src/app/api/news/route.ts` — a `fetchSeason`/`fetchAiringFor` köré cache:
```ts
import { getCached, setCached } from '@/lib/api-cache'
// ...
  const seasonKey = `season:${season.season}:${season.year}`
  let seasonList = await getCached<Awaited<ReturnType<typeof fetchSeason>>>(seasonKey)
  if (!seasonList) {
    seasonList = await fetchSeason(season.season, season.year).catch(() => [])
    if (seasonList.length) await setCached(seasonKey, seasonList, 86400) // napi
  }

  const airingKey = `airing:${followedIds.slice().sort((a, b) => a - b).join(',')}`
  let airing = followedIds.length ? await getCached<Awaited<ReturnType<typeof fetchAiringFor>>>(airingKey) : []
  if (followedIds.length && !airing) {
    airing = await fetchAiringFor(followedIds).catch(() => [])
    if (airing.length) await setCached(airingKey, airing, 3600) // óránkénti
  }
  airing = airing ?? []
```
Töröld a régi `Promise.all([...])`-t, ami közvetlenül hívta ezeket.

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: zöld.

```bash
git add src/db/schema.ts src/lib/api-cache.ts src/lib/api-cache.test.ts src/app/api/news/route.ts
git commit -m "feat(catalog): TTL cache for seasonal (daily) + airing (hourly) on News"
```

### Task D7: WS1 táblák migrációja + heti GH-Actions cron

**Files:**
- Create: `scripts/migrate-catalog-cache.mjs`
- Create: `.github/workflows/offline-db-sync.yml`

- [ ] **Step 1: Migrációs script (title_recommendations + api_cache)**

`scripts/migrate-catalog-cache.mjs`:
```js
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
async function main() {
  await sql`CREATE TABLE IF NOT EXISTS title_recommendations (
    id serial PRIMARY KEY, anilist_id integer NOT NULL, rec_anilist_id integer NOT NULL,
    rating integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now())`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS title_rec_unique ON title_recommendations (anilist_id, rec_anilist_id)`
  await sql`CREATE TABLE IF NOT EXISTS api_cache (
    key text PRIMARY KEY, value jsonb NOT NULL, expires_at timestamp NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now())`
  console.log('migrate-catalog-cache: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: GH-Actions workflow**

`.github/workflows/offline-db-sync.yml`:
```yaml
name: offline-db-sync
on:
  schedule:
    - cron: '17 4 * * 1' # hétfő 04:17 UTC
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - name: import offline-db
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
        run: node scripts/import-offline-db.mjs
      - name: backfill missing descriptions
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
        run: node scripts/backfill-descriptions.mjs --only-missing
      - name: recompute community scores
        env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
        run: node scripts/recompute-scores.mjs
```

- [ ] **Step 3: `backfill-descriptions.mjs` `--only-missing` flag ellenőrzése**

Olvasd el a `scripts/backfill-descriptions.mjs`-t. Ha nincs `--only-missing` kapcsolója, add hozzá: `const onlyMissing = process.argv.includes('--only-missing')` és a lekérdezés szűrjön `WHERE description IS NULL`-ra ha be van kapcsolva. (Ha már van ilyen szűrés más néven, igazítsd a workflow-t ahhoz.)

- [ ] **Step 4: Verify + commit**

Run: `node --check scripts/migrate-catalog-cache.mjs`
Expected: OK.

```bash
git add scripts/migrate-catalog-cache.mjs .github/workflows/offline-db-sync.yml scripts/backfill-descriptions.mjs
git commit -m "chore(catalog): WS1 migration script + weekly offline-db sync workflow"
```

---

## DB-runtime futtatási sorrend (a USER futtatja Neonon, backup után)

1. `DATABASE_URL="<neon-branch>" node scripts/migrate-ai-tier-usage.mjs`
2. `DATABASE_URL="<neon-branch>" node scripts/migrate-catalog-cache.mjs`
3. `DATABASE_URL="<neon-branch>" node scripts/import-offline-db.mjs` (dry-run branchen; órák lehet)
4. `DATABASE_URL="<neon-branch>" node scripts/backfill-descriptions.mjs --only-missing`
5. `DATABASE_URL="<neon-branch>" node scripts/sync-title-recs.mjs`
6. `DATABASE_URL="<neon-branch>" node scripts/recompute-scores.mjs`
7. app-smoke (recommend/browse/news/vibe/wrapped/public) → CSAK utána prod-cutover (backup előbb!) + GH-secret `DATABASE_URL`.

---

## Self-Review — spec-lefedettség

- **WS1** — offline-db import (D1,D2) ✅; read-repoint recommend (D3) + browse (D5) ✅; seasonal/airing cache (D6) ✅; AniList szűkítve import+seasonal+external-VS-re ✅; heti cron (D7) ✅; friss-import avgScore + description-backfill lánc (D2 score-map + D7 workflow) ✅; `title`-be tölt, nem új tábla ✅.
- **WS2** — free/paid tier (C3) ✅; endpointonkénti limit (C2,C4) ✅; `ai_usage_log` + `AI_COST_PER_1K_TOKENS` (C1,C3,C4) ✅.
- **WS3** — whitelist serializer + regressziós teszt + checklist (A1) ✅.
- **WS4** — recommend/vibe/wrapped/seasonal edge + graceful fallback (B1,B2 + D3/D6 catch-ek) ✅; stack-leak fix (B1) ✅.

**Type-konzisztencia:** `consumeAiQuota(userId, endpoint)` egységes (C4 + minden hívó C4/Step5); `glmChat(messages, {userId,endpoint})` egységes; `buildLocalCandidates(...)` végső 5-argumentumos aláírás D4-ben rögzítve; `RecCandidate` alak megőrizve (D3).

**Ismert korlát:** a route/DB-lépések nincsenek unit-teszttel (repo nem mockol db-t); ezeket `tsc`+`lint`+user-smoke fedi. A pure-fn logika (mapper, rec-pool, quota, cost, cache-frissesség, public-whitelist) vitest-tel tesztelt.
