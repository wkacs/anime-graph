# Ízlés-jelek és lokális rangsor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az AI a véleményekből strukturált ízlés-jeleket is tanuljon, a rangsorolás pedig ezekből lokálisan, modellhívás nélkül történjen.

**Architecture:** Az `extract` (ami vélemény-íráskor amúgy is lefut) a szabad szöveges tények mellé kötött szókészletű jeleket ad vissza; ezek a `taste_signal` táblába kerülnek. A `buildTasteVector` a mai viselkedési vektor mellé épít egy szemantikus vektort a jelekből, külön normalizálva, `α = 0.4` súllyal. A `fit-score` lesz az egyetlen rangsoroló, a `computeFit` `top`/`against` kimenete adja az ingyenes indoklást; az LLM csak kérésre ír prózát.

**Tech Stack:** Next.js 15.5.20 (App Router), Neon Postgres + Drizzle, vitest, GLM `glm-4.7-flash`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-26-izles-jelek-lokalis-rangsor-design.md` (commit `8df13f0`). Ütközés esetén a spec dönt.
- **Tesztek adatbázis és hálózat nélkül futnak.** Minden új logika tiszta függvény.
- **Teszt-parancsok:** teljes futás `npm test`; egy fájl `npx vitest run <path>`; típusellenőrzés `npx tsc --noEmit`; lint `npx eslint src --max-warnings=0`.
- **ISR-szabály:** ISR-oldal alatt futó modul soha nem importálhatja a no-store `db` klienst, csak `dbStatic`-ot (`src/lib/isr-db-client.test.ts` őrzi). A `getRequestConfig` és bármi, ami `cookies()`/`headers()`-t olvas, ugyanígy tilos az ISR-úton.
- **Migrációs scriptek** `process.env.DATABASE_URL`-t olvasnak, **nem** a `.env.local`-t. Futtatás: `DATABASE_URL="..." node scripts/<name>.mjs`. Idempotens (`IF NOT EXISTS`).
- **🔴 Egyetlen Neon adatbázis van:** a `.env.local` és a prod ugyanarra a `neondb`-re mutat. Minden migráció éles adaton fut.
- **`α = 0.4`**, tényleges súly: `α × min(1, jelszám / 20)`.
- **`MIN_SAMPLE = 5`**, `TAG_FEATURE_WEIGHT = 0.6` — meglévő konstansok, nem változnak.
- **Változatlanul AI-on marad:** `extract` (maga a tanulás), `profile`, `taste-eras`, `digest`, `nl-search`, `duo`, `group-pick`.
- **Commit-nyelv:** magyar, ékezet nélkül, a repó stílusában (`feat(taste): ...`).

---

## Fájl-térkép

**Új fájlok:**

| Fájl | Felelősség |
|---|---|
| `scripts/migrate-taste-signal.mjs` | DDL: `taste_signal` tábla + indexek |
| `src/lib/taste-features.ts` | A kötött szókészlet: feature-kulcs képzés egy `title` sorból (`titleFeatureKeys`), hossz-sáv, korszak |
| `src/lib/taste-features.test.ts` | Fenti tesztjei |
| `scripts/backfill-taste-signals.mjs` | Egyszeri, AI nélküli jel-backfill a meglévő tényekből |
| `src/lib/fit-reason.ts` | A `computeFit` `top`/`against` kimenetéből szöveges indoklás |
| `src/lib/fit-reason.test.ts` | Fenti tesztjei |
| `src/app/api/recommend/explain/route.ts` | „Mondd el bővebben" — egyetlen AI-hívás igényre |

**Módosuló fájlok:**

| Fájl | Változás |
|---|---|
| `src/db/schema.ts` | `tasteSignal` tábla |
| `src/lib/extract.ts` | `signals` a sémában és a promptban |
| `src/app/api/opinion/route.ts` | jelek mentése a szókészlet-őrrel |
| `src/lib/fit-score.ts` | szemantikus ág, α-logika, kibővített `FitTarget` |
| `src/lib/local-candidates.ts` | `tags` átvezetése a jelölt-úton |
| `src/app/api/recommend/route.ts` | lokális rangsor + lokális indoklás |
| `src/app/api/news/season-scores/route.ts`, `.../upcoming/route.ts` | lokális pontozás |
| `src/app/api/vibe/route.ts`, `src/app/vibe/page.tsx` | chipek lokálisan |
| `src/lib/vibe-presets.ts` | chip → katalógus-feature leképezés |
| `src/lib/anilist.ts` | `SEASON_QUERY` tagekkel, `RecCandidate.tags` |
| `src/lib/candidates.ts` | `genreWeights`/`rankCandidates` kivezetése (fájl törlése) |
| `src/components/RecommendMorph.tsx` | „Mondd el bővebben" gomb |

## Eltérés a spectől

A spec 7. szakasza a **vibe szabad szöveghez** is lokális rangsort ír elő, egyetlen
AI-hívással a szöveg → feature-ök átfordítására. Ez a terv **nem tartalmazza**: a szabad
szöveges ág változatlanul a mai AI-utat járja.

Indok: a chip-elemzés kiderítette, hogy a `Hangulat` és a `Tempó` csoportnak nincs
katalógus-megfelelője. A szabad szöveg tipikusan pont ilyen fogalmakat tartalmaz
(„lassú, hangulatos"), tehát a feature-re fordítás sokszor üres kulcslistát adna, és a
rangsor rosszabb lenne a mainál. Ez külön kört érdemel, ahol előbb megnézzük, mit ad
vissza az átfordítás valós kéréseken.

---

# 1. SZAKASZ — ADAT

## Task 1: A kötött szókészlet

**Files:**
- Create: `src/lib/taste-features.ts`, `src/lib/taste-features.test.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `type FeatureSource = { genres: string[]; tags: {name: string}[]; format: string | null; episodes: number | null; chapters: number | null; year: number | null; studio: string | null; mediaType: string; relations: {type: string; anilistId: number; title: string}[] }`, `lengthBand(src): string | null`, `eraOf(year): string | null`, `titleFeatureKeys(src): string[]`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/taste-features.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { lengthBand, eraOf, titleFeatureKeys, type FeatureSource } from './taste-features'

const base: FeatureSource = {
  genres: ['Sci-Fi', 'Drama'], tags: [{ name: 'Time Manipulation' }],
  format: 'TV', episodes: 24, chapters: null, year: 2011,
  studio: 'White Fox', mediaType: 'ANIME',
  relations: [{ type: 'SOURCE', anilistId: 1, title: 'VN' }],
}

describe('lengthBand', () => {
  it('anime savok epizodszam szerint', () => {
    expect(lengthBand({ ...base, episodes: 12 })).toBe('short')
    expect(lengthBand({ ...base, episodes: 24 })).toBe('standard')
    expect(lengthBand({ ...base, episodes: 64 })).toBe('long')
    expect(lengthBand({ ...base, episodes: 1000 })).toBe('endless')
  })
  it('manga savok fejezetszam szerint', () => {
    const m = { ...base, mediaType: 'MANGA', episodes: null }
    expect(lengthBand({ ...m, chapters: 20 })).toBe('short')
    expect(lengthBand({ ...m, chapters: 80 })).toBe('standard')
    expect(lengthBand({ ...m, chapters: 250 })).toBe('long')
    expect(lengthBand({ ...m, chapters: 900 })).toBe('endless')
  })
  it('adat nelkul nincs sav', () => {
    expect(lengthBand({ ...base, episodes: null })).toBeNull()
  })
})

describe('eraOf', () => {
  it('evtizedre kerekit', () => {
    expect(eraOf(2011)).toBe('2010s')
    expect(eraOf(1999)).toBe('1990s')
  })
  it('null ev nincs korszak', () => { expect(eraOf(null)).toBeNull() })
})

describe('titleFeatureKeys', () => {
  it('minden tengelyt kisbetus kulccsa kepez', () => {
    const keys = titleFeatureKeys(base)
    expect(keys).toContain('g:sci-fi')
    expect(keys).toContain('t:time manipulation')
    expect(keys).toContain('format:tv')
    expect(keys).toContain('length:standard')
    expect(keys).toContain('era:2010s')
    expect(keys).toContain('studio:white fox')
  })
  it('hianyzo mezo nem ad kulcsot', () => {
    const keys = titleFeatureKeys({ ...base, studio: null, year: null, format: null })
    expect(keys.some((k) => k.startsWith('studio:'))).toBe(false)
    expect(keys.some((k) => k.startsWith('era:'))).toBe(false)
    expect(keys.some((k) => k.startsWith('format:'))).toBe(false)
  })
  it('nincs duplikatum', () => {
    const keys = titleFeatureKeys({ ...base, genres: ['Sci-Fi', 'Sci-Fi'] })
    expect(new Set(keys).size).toBe(keys.length)
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/taste-features.test.ts`
Expected: FAIL — „Failed to resolve import './taste-features'"

- [ ] **Step 3: Írd meg az implementációt**

Create `src/lib/taste-features.ts`:

```typescript
// A pontozó jelek KÖTÖTT szókészlete. Csak olyan tengely kerülhet ide, amit egy
// MÉG NEM LÁTOTT címre is elő tudunk állítani a `title` sorból — különben a jel
// sosem találkozna a jelölt feature-jeivel és nem számítana semmit.

export type FeatureSource = {
  genres: string[]
  tags: { name: string }[]
  format: string | null
  episodes: number | null
  chapters: number | null
  year: number | null
  studio: string | null
  mediaType: string
  relations: { type: string; anilistId: number; title: string }[]
}

const ANIME_BANDS: [number, string][] = [[13, 'short'], [26, 'standard'], [99, 'long']]
const MANGA_BANDS: [number, string][] = [[30, 'short'], [100, 'standard'], [300, 'long']]

export function lengthBand(src: FeatureSource): string | null {
  const isManga = src.mediaType === 'MANGA'
  const count = isManga ? src.chapters : src.episodes
  if (count == null) return null
  for (const [max, band] of isManga ? MANGA_BANDS : ANIME_BANDS) {
    if (count <= max) return band
  }
  return 'endless'
}

export function eraOf(year: number | null): string | null {
  if (year == null) return null
  return `${Math.floor(year / 10) * 10}s`
}

function sourceMedium(src: FeatureSource): string | null {
  return src.relations.find((r) => r.type === 'SOURCE') ? 'adaptation' : null
}

/** Egy cím teljes feature-készlete, normalizált (kisbetűs) kulcsokként. */
export function titleFeatureKeys(src: FeatureSource): string[] {
  const keys = [
    ...src.genres.map((g) => `g:${g.toLowerCase()}`),
    ...src.tags.map((t) => `t:${t.name.toLowerCase()}`),
    src.format ? `format:${src.format.toLowerCase()}` : null,
    lengthBand(src) ? `length:${lengthBand(src)}` : null,
    eraOf(src.year) ? `era:${eraOf(src.year)}` : null,
    src.studio ? `studio:${src.studio.toLowerCase()}` : null,
    sourceMedium(src) ? `source:${sourceMedium(src)}` : null,
  ].filter((k): k is string => k !== null)
  return [...new Set(keys)]
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/taste-features.test.ts`
Expected: PASS, 9 teszt

- [ ] **Step 5: Commit**

```bash
git add src/lib/taste-features.ts src/lib/taste-features.test.ts
git commit -m "feat(taste): kototte szokeszlet a pontozo jelekhez (taste-features)"
```

---

## Task 2: `taste_signal` tábla

**Files:**
- Create: `scripts/migrate-taste-signal.mjs`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `tasteSignal` Drizzle-tábla (`id`, `userId`, `titleId`, `feature`, `polarity`, `strength`, `source`, `createdAt`)

- [ ] **Step 1: Migrációs script**

Create `scripts/migrate-taste-signal.mjs`:

```javascript
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS taste_signal (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      title_id integer NOT NULL REFERENCES title(id) ON DELETE CASCADE,
      feature text NOT NULL,
      polarity integer NOT NULL,
      strength real NOT NULL DEFAULT 1,
      source text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  await sql`CREATE INDEX IF NOT EXISTS taste_signal_user ON taste_signal (user_id)`
  // egy cimre egy feature egyszer — ujra-extractalaskor felulirodik
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS taste_signal_unique
            ON taste_signal (user_id, title_id, feature)`
  console.log('migrate-taste-signal: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Drizzle-séma**

Modify `src/db/schema.ts` — a `tasteMemory` definíció után:

```typescript
// Gépi ízlés-jelek: az extract kötött szókészletű kimenete. NEM keverjük a
// taste_memory-ba, mert az sorai megjelennek a felületen (TasteCard, ProfileReveal),
// ezek viszont csak a rangsoroló vektort táplálják.
export const tasteSignal = pgTable('taste_signal', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  titleId: integer('title_id').notNull().references(() => title.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  polarity: integer('polarity').notNull(), // 1 | -1
  strength: real('strength').notNull().default(1), // 0..1
  source: text('source').notNull(), // opinion | backfill
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('taste_signal_user').on(t.userId),
  uniqueIndex('taste_signal_unique').on(t.userId, t.titleId, t.feature),
])
```

- [ ] **Step 3: Ellenőrzés és migráció**

Run: `npx tsc --noEmit`
Expected: exit 0

Run: `DATABASE_URL="<a .env.local DATABASE_URL értéke>" node scripts/migrate-taste-signal.mjs`
Expected: `migrate-taste-signal: OK`. Futtasd **kétszer** — másodszorra is `OK`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-taste-signal.mjs src/db/schema.ts
git commit -m "feat(taste): taste_signal tabla + migracio"
```

---

## Task 3: Az `extract` strukturált jelekkel

**Files:**
- Modify: `src/lib/extract.ts`, `src/lib/extract.test.ts`

**Interfaces:**
- Consumes: `titleFeatureKeys` (Task 1)
- Produces: `type Signal = { feature: string; polarity: 1 | -1; strength: number }`, `parseExtract(raw): { facts: Fact[]; signals: Signal[] }`, `buildExtractMessages(title, opinion, locale, allowedFeatures)`, `extractAll(title, opinion, locale, allowedFeatures, opts)`

- [ ] **Step 1: Írd meg a bukó tesztet**

A `src/lib/extract.test.ts` végére:

```typescript
import { parseExtract, filterSignals } from './extract'

describe('parseExtract', () => {
  it('tenyeket es jeleket is visszaad', () => {
    const raw = '{"facts":[{"kind":"like","text":"feszes tempo"}],' +
      '"signals":[{"feature":"t:Time Manipulation","polarity":1,"strength":0.8}]}'
    const out = parseExtract(raw)
    expect(out.facts).toHaveLength(1)
    expect(out.signals).toEqual([{ feature: 't:time manipulation', polarity: 1, strength: 0.8 }])
  })
  it('hianyzo signals mezo ures tombot ad (visszafele kompatibilis)', () => {
    expect(parseExtract('{"facts":[{"kind":"like","text":"jo zene"}]}').signals).toEqual([])
  })
})

describe('filterSignals', () => {
  const allowed = ['g:sci-fi', 't:time manipulation', 'length:standard']
  it('a szokeszleten kivuli jelet eldobja', () => {
    const out = filterSignals(
      [{ feature: 't:time manipulation', polarity: 1, strength: 0.8 },
       { feature: 't:kitalalt tag', polarity: 1, strength: 1 }],
      allowed,
    )
    expect(out.map((s) => s.feature)).toEqual(['t:time manipulation'])
  })
  it('a strengthet 0..1 koze szoritja, a polaritast +-1-re', () => {
    const out = filterSignals(
      [{ feature: 'g:sci-fi', polarity: 5 as 1, strength: 9 }], allowed,
    )
    expect(out[0]).toEqual({ feature: 'g:sci-fi', polarity: 1, strength: 1 })
  })
  it('nulla strength kiesik — nem hordoz informaciot', () => {
    expect(filterSignals([{ feature: 'g:sci-fi', polarity: 1, strength: 0 }], allowed)).toEqual([])
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/extract.test.ts`
Expected: FAIL — `parseExtract` és `filterSignals` nincs exportálva

- [ ] **Step 3: Bővítsd az `extract.ts`-t**

Modify `src/lib/extract.ts` — a `factsSchema` mellé és a `SYSTEM` bővítése:

```typescript
export const signalSchema = z.object({
  feature: z.string().min(2).max(80),
  polarity: z.number(),
  strength: z.number(),
})

export const extractSchema = z.object({
  facts: factsSchema.shape.facts,
  signals: z.array(signalSchema).max(20).default([]),
})

export type Signal = { feature: string; polarity: 1 | -1; strength: number }

export function parseExtract(raw: string): { facts: Fact[]; signals: Signal[] } {
  const parsed = extractSchema.parse(extractJson(raw))
  return {
    facts: parsed.facts,
    signals: parsed.signals.map((s) => ({
      feature: s.feature.toLowerCase(),
      polarity: s.polarity >= 0 ? 1 : -1,
      strength: Math.max(0, Math.min(1, s.strength)),
    })),
  }
}

/** Szókészlet-őr: ami nincs a cím feature-készletében, azt eldobjuk — nem
 *  szennyezheti a vektort olyan kulcs, amit a katalógus sosem ad vissza. */
export function filterSignals(signals: Signal[], allowedFeatures: string[]): Signal[] {
  const allowed = new Set(allowedFeatures.map((f) => f.toLowerCase()))
  return signals
    .map((s) => ({
      feature: s.feature.toLowerCase(),
      polarity: (s.polarity >= 0 ? 1 : -1) as 1 | -1,
      strength: Math.max(0, Math.min(1, s.strength)),
    }))
    .filter((s) => allowed.has(s.feature) && s.strength > 0)
}
```

A `SYSTEM` konstans végére told hozzá a jel-utasítást, és a `buildExtractMessages`
kapjon `allowedFeatures: string[]` paramétert, ami a user-üzenetbe kerül:

```typescript
const SIGNAL_RULES = `Ezen felul adj vissza egy "signals" tombot: a felhasznalo
velemenyebol MELY konkret jellemzok tetszettek vagy zavartak. CSAK a megadott
"Valaszthato jellemzok" listabol valaszthatsz kulcsot, mast NE talalj ki.
Alak: {"feature":"<kulcs a listabol>","polarity":1 vagy -1,"strength":0..1}.
Ha egy jellemzo nem derul ki egyertelmuen a velemenybol, hagyd ki.`
```

A `buildExtractMessages` user-üzenete egészüljön ki:

```typescript
    { role: 'user', content:
      `Anime: ${title}\n\nVélemény:\n${opinion}\n\n` +
      `Választható jellemzők:\n${allowedFeatures.join('\n')}` },
```

Az `extractFacts` helyére lépjen `extractAll`, ami a `parseExtract`-et használja és
`{ facts, signals }`-t ad vissza; a retry-ág változatlan.

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/extract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/extract.ts src/lib/extract.test.ts
git commit -m "feat(taste): extract strukturalt jeleket is ad vissza + szokeszlet-or"
```

---

## Task 4: Jelek mentése vélemény-írásnál

**Files:**
- Modify: `src/app/api/opinion/route.ts`

**Interfaces:**
- Consumes: `extractAll`, `filterSignals` (Task 3); `titleFeatureKeys` (Task 1); `tasteSignal` (Task 2)
- Produces: a `POST /api/opinion` a `taste_signal`-be is ír

- [ ] **Step 1: Írd át a mentő ágat**

Modify `src/app/api/opinion/route.ts` — a `try` blokkban, a jelenlegi `extractFacts`-hívás helyén:

```typescript
    const locale = await userLocale(userId)
    // a jelolt feature-ok a VELEMENY TARGYANAK sajat keszlete — igy a prompt nem
    // hizik meg az AniList ~500 tagjetol, es a jel garantaltan illeszkedik
    const [titleRow] = await db.select({
      id: title.id, genres: title.genres, tags: title.tags, format: title.format,
      episodes: title.episodes, chapters: title.chapters, year: title.year,
      studio: title.studio, mediaType: title.mediaType, relations: title.relations,
    }).from(title).where(eq(title.id, animeRow.titleId))
    const allowed = titleRow ? titleFeatureKeys(titleRow) : []

    const { facts, signals } = await extractAll(
      animeRow.titleRomaji, rawText, locale, allowed, { userId, endpoint: 'opinion' },
    )
```

A tények mentése után (a `tasteMemory` insert alá):

```typescript
    const clean = filterSignals(signals, allowed)
    if (titleRow && clean.length) {
      await db.insert(tasteSignal).values(clean.map((s) => ({
        userId, titleId: titleRow.id, feature: s.feature,
        polarity: s.polarity, strength: s.strength, source: 'opinion',
      }))).onConflictDoUpdate({
        target: [tasteSignal.userId, tasteSignal.titleId, tasteSignal.feature],
        set: { polarity: sql`excluded.polarity`, strength: sql`excluded.strength` },
      })
    }
```

Importáld: `title`, `tasteSignal` a sémából, `titleFeatureKeys`, `extractAll`, `filterSignals`.

- [ ] **Step 2: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 3: Commit**

```bash
git add src/app/api/opinion/route.ts
git commit -m "feat(taste): velemeny-mentes a taste_signal-be is ir"
```

---

## Task 5: Ingyenes backfill a meglévő tényekből

**Files:**
- Create: `scripts/backfill-taste-signals.mjs`

**Interfaces:**
- Consumes: a `taste_signal` tábla (Task 2)
- Produces: `source='backfill'` sorok

- [ ] **Step 1: Írd meg a scriptet**

Create `scripts/backfill-taste-signals.mjs`:

```javascript
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// AI NELKUL: a meglevo teny szoveget osszevetjuk a cim mufaj- es tagneveivel.
// Durva, de ingyen ad kiindulasi jelkeszletet. A `note` kimarad (nincs polaritasa),
// es a globalis, cim nelkuli tenyek (source='settings') sem kerulnek be.
async function main() {
  const rows = await sql`
    SELECT tm.user_id, tm.kind, tm.text, a.title_id, t.genres, t.tags
    FROM taste_memory tm
    JOIN anime a ON a.id = tm.anime_id
    JOIN title t ON t.id = a.title_id
    WHERE tm.anime_id IS NOT NULL AND tm.kind IN ('like','dislike')`

  let written = 0
  for (const r of rows) {
    const lower = r.text.toLowerCase()
    const names = [
      ...r.genres.map((g) => ['g:' + g.toLowerCase(), g.toLowerCase()]),
      ...(r.tags ?? []).map((t) => ['t:' + t.name.toLowerCase(), t.name.toLowerCase()]),
    ]
    const polarity = r.kind === 'like' ? 1 : -1
    for (const [key, needle] of names) {
      if (!lower.includes(needle)) continue
      await sql`
        INSERT INTO taste_signal (user_id, title_id, feature, polarity, strength, source)
        VALUES (${r.user_id}, ${r.title_id}, ${key}, ${polarity}, 0.5, 'backfill')
        ON CONFLICT (user_id, title_id, feature) DO NOTHING`
      written++
    }
  }
  console.log(`backfill-taste-signals: ${rows.length} teny, ${written} jel`)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

A `strength: 0.5`, mert a szöveg-egyezés gyengébb bizonyíték, mint egy célzott AI-jel.

- [ ] **Step 2: Futtasd**

Run: `DATABASE_URL="<a .env.local értéke>" node scripts/backfill-taste-signals.mjs`
Expected: `backfill-taste-signals: <n> teny, <m> jel`

Futtasd **kétszer** — másodszorra ugyanannyi tényt dolgoz fel, de az `ON CONFLICT DO NOTHING`
miatt új sort nem ír.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-taste-signals.mjs
git commit -m "feat(taste): ingyenes jel-backfill a meglevo tenyekbol"
```

---

# 2. SZAKASZ — VEKTOR

## Task 6: Szemantikus ág a `buildTasteVector`-ban

**Files:**
- Modify: `src/lib/fit-score.ts`, `src/lib/fit-score.test.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `type SignalInput = { feature: string; polarity: number; strength: number }`, `SIGNAL_ALPHA = 0.4`, `SIGNAL_FULL_WEIGHT_AT = 20`, `buildTasteVector(items, signals?)`, kibővített `FitTarget`

- [ ] **Step 1: Írd meg a bukó tesztet**

A `src/lib/fit-score.test.ts` végére:

```typescript
import { buildTasteVector, computeFit, SIGNAL_ALPHA } from './fit-score'

const items = Array.from({ length: 10 }, () => ({
  genres: ['Action'], tags: [], status: 'completed', myScore: 8,
}))

describe('szemantikus ag', () => {
  it('jel nelkul a vektor bitre azonos a mai viselkedessel', () => {
    const a = buildTasteVector(items)
    const b = buildTasteVector(items, [])
    expect([...b.vector.entries()]).toEqual([...a.vector.entries()])
  })

  it('a jel uj kulcsot is behozhat, amit a viselkedes nem ismer', () => {
    const v = buildTasteVector(items, [
      { feature: 'length:short', polarity: 1, strength: 1 },
    ])
    expect(v.vector.has('length:short')).toBe(true)
  })

  it('negativ jel lehuzza a kulcsot', () => {
    const v = buildTasteVector(items, [
      { feature: 'g:action', polarity: -1, strength: 1 },
    ])
    expect(v.vector.get('g:action')!).toBeLessThan(buildTasteVector(items).vector.get('g:action')!)
  })

  it('keves jelnel az alfa aranyosan csokken', () => {
    const few = buildTasteVector(items, [{ feature: 'length:short', polarity: 1, strength: 1 }])
    const many = buildTasteVector(items, Array.from({ length: 20 }, (_, i) => ({
      feature: i === 0 ? 'length:short' : `t:x${i}`, polarity: 1, strength: 1,
    })))
    expect(many.vector.get('length:short')!).toBeGreaterThan(few.vector.get('length:short')!)
  })

  it('az alfa a specben rogzitett ertek', () => {
    expect(SIGNAL_ALPHA).toBe(0.4)
  })
})

describe('kibovitett FitTarget', () => {
  it('az uj tengelyek is szamitanak a pontszamban', () => {
    const v = buildTasteVector(items, Array.from({ length: 20 }, () => ({
      feature: 'length:short', polarity: 1, strength: 1,
    })))
    const withBand = computeFit(v, { genres: [], tags: [], extraKeys: ['length:short'] })
    expect(withBand).not.toBeNull()
    expect(withBand!.score).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/fit-score.test.ts`
Expected: FAIL — a `buildTasteVector` egy argumentumot vár, `SIGNAL_ALPHA` és `extraKeys` nincs

- [ ] **Step 3: Bővítsd a `fit-score.ts`-t**

Modify `src/lib/fit-score.ts`:

```typescript
export type SignalInput = { feature: string; polarity: number; strength: number }

// A szemantikus jel sulya a kombinalt vektorban. Kevés jelnel aranyosan csokken,
// hogy egy-ket velemeny ne forgassa fel a listat.
export const SIGNAL_ALPHA = 0.4
export const SIGNAL_FULL_WEIGHT_AT = 20

function normalize(vector: Map<string, number>): Map<string, number> {
  let max = 0
  for (const v of vector.values()) max = Math.max(max, Math.abs(v))
  if (max > 0) for (const [k, v] of vector) vector.set(k, v / max)
  return vector
}

function behaviouralVector(items: TasteItem[]): Map<string, number> {
  const vector = new Map<string, number>()
  for (const it of items) {
    const w = itemWeight(it)
    if (w === 0) continue
    for (const g of it.genres) {
      const key = `g:${g.toLowerCase()}`
      vector.set(key, (vector.get(key) ?? 0) + w)
    }
    for (const t of it.tags) {
      const key = `t:${t.name.toLowerCase()}`
      vector.set(key, (vector.get(key) ?? 0) + w * TAG_FEATURE_WEIGHT)
    }
  }
  return normalize(vector)
}

function semanticVector(signals: SignalInput[]): Map<string, number> {
  const vector = new Map<string, number>()
  for (const s of signals) {
    const key = s.feature.toLowerCase()
    vector.set(key, (vector.get(key) ?? 0) + (s.polarity >= 0 ? 1 : -1) * s.strength)
  }
  return normalize(vector)
}

export function buildTasteVector(items: TasteItem[], signals: SignalInput[] = []): TasteVector {
  const behaviour = behaviouralVector(items)
  if (signals.length === 0) return { vector: behaviour, sample: items.length }

  // kulon-kulon normalizalunk: tobb szaz ertekeles all szemben par tucat jellel,
  // kozos normalizalas elnyomna a szemantikat
  const semantic = semanticVector(signals)
  const alpha = SIGNAL_ALPHA * Math.min(1, signals.length / SIGNAL_FULL_WEIGHT_AT)
  const combined = new Map<string, number>()
  for (const key of new Set([...behaviour.keys(), ...semantic.keys()])) {
    combined.set(key, (behaviour.get(key) ?? 0) * (1 - alpha) + (semantic.get(key) ?? 0) * alpha)
  }
  return { vector: combined, sample: items.length }
}
```

A `FitTarget` és a `targetFeatures` bővítése az új tengelyekre:

```typescript
export type FitTarget = { genres: string[]; tags: TagEntryLite[]; extraKeys?: string[] }

function targetFeatures(target: FitTarget): { key: string; name: string; fw: number }[] {
  return [
    ...target.genres.map((g) => ({ key: `g:${g.toLowerCase()}`, name: g, fw: 1 })),
    ...target.tags.map((t) => ({ key: `t:${t.name.toLowerCase()}`, name: t.name, fw: TAG_FEATURE_WEIGHT })),
    ...(target.extraKeys ?? []).map((k) => ({ key: k.toLowerCase(), name: k.split(':')[1] ?? k, fw: 0.5 })),
  ]
}
```

A származtatott tengelyek `fw = 0.5` súlyt kapnak: gyengébb jel, mint egy műfaj, de erősebb a semminél.

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/fit-score.test.ts`
Expected: PASS — a **meglévő** fit-score tesztek is zöldek maradnak

- [ ] **Step 5: Commit**

```bash
git add src/lib/fit-score.ts src/lib/fit-score.test.ts
git commit -m "feat(taste): szemantikus ag a buildTasteVector-ban (alfa=0.4)"
```

---

## Task 7: `tags` átvezetése a jelölt-úton

**Files:**
- Modify: `src/lib/local-candidates.ts`, `src/lib/local-candidates.test.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `CatalogRow` és `RecCandidate` `tags` mezővel

- [ ] **Step 1: Írd meg a bukó tesztet**

A `src/lib/local-candidates.test.ts` végére:

```typescript
it('a tageket atviszi a jeloltre — enelkul a vektor felig vakon pontozna', () => {
  const out = buildLocalCandidates(
    [{ anilistId: 1, genres: ['Action'], relations: [] }],
    [{
      anilistId: 2, titleRomaji: 'X', coverUrl: null, genres: ['Action'],
      tags: [{ name: 'Time Manipulation' }], communityScore: 8, avgScore: 80, relations: [],
    }],
    new Set(),
  )
  expect(out[0].tags).toEqual([{ name: 'Time Manipulation' }])
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/local-candidates.test.ts`
Expected: FAIL — a `tags` nincs a típusban, illetve `undefined`

- [ ] **Step 3: Vezesd át**

Modify `src/lib/local-candidates.ts` — a `CatalogRow` kapjon `tags: { name: string }[]`,
és a visszatérési map is adja tovább:

```typescript
  return scored.map(({ c }): RecCandidate => ({
    anilistId: c.anilistId,
    title: c.titleRomaji,
    coverUrl: c.coverUrl,
    genres: c.genres,
    tags: c.tags,
    avgScore: c.avgScore,
  }))
```

Modify `src/lib/anilist.ts` — a `RecCandidate` típus kapjon `tags?: { name: string }[]`
(opcionális, mert az élő AniList-ágak nem töltik).

Modify `src/app/api/recommend/route.ts` — a katalógus-lekérdezés `select`-je húzza be
a `title.tags` oszlopot is.

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npm test && npx tsc --noEmit`
Expected: minden zöld

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-candidates.ts src/lib/local-candidates.test.ts src/lib/anilist.ts src/app/api/recommend/route.ts
git commit -m "feat(taste): tags atvezetese a jelolt-uton (a vektor a tageken a legerosebb)"
```

---

# 3. SZAKASZ — FELÜLETEK

## Task 8: Lokális indoklás

**Files:**
- Create: `src/lib/fit-reason.ts`, `src/lib/fit-reason.test.ts`

**Interfaces:**
- Consumes: `FitResult` (`{ score, top, against }`) a `fit-score`-ból
- Produces: `fitReason(fit: FitResult, locale: 'en' | 'hu'): string`

A `computeFit` **már ma visszaadja** a hozzájáruló feature-öket (`top`/`against`) — nem kell
új `explainFit`, csak szöveggé fogalmazni őket.

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/fit-reason.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { fitReason } from './fit-reason'

const fit = {
  score: 82,
  top: [{ name: 'Time Manipulation', weight: 0.9 }, { name: 'Sci-Fi', weight: 0.7 }],
  against: [{ name: 'Ecchi', weight: -0.6 }],
}

describe('fitReason', () => {
  it('a mellette szolo feature-oket sorolja fel', () => {
    const r = fitReason(fit, 'hu')
    expect(r).toContain('Time Manipulation')
    expect(r).toContain('Sci-Fi')
  })
  it('az ellene szolot is megemliti', () => {
    expect(fitReason(fit, 'hu')).toContain('Ecchi')
  })
  it('angolul mas a szoveg', () => {
    expect(fitReason(fit, 'en')).not.toBe(fitReason(fit, 'hu'))
  })
  it('ures hozzajarulasnal is ad valamit, nem dob', () => {
    expect(fitReason({ score: 50, top: [], against: [] }, 'hu')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/fit-reason.test.ts`
Expected: FAIL — nincs `./fit-reason` modul

- [ ] **Step 3: Írd meg**

Create `src/lib/fit-reason.ts`:

```typescript
import type { FitResult } from './fit-score'
import type { Locale } from './locale'

// Ingyenes, oszinte indoklas: a vektor pontosan tudja, MI hozta a pontszamot.
// Nincs modellhivas, tehat kvota kimerulesekor is mukodik.
export function fitReason(fit: FitResult, locale: Locale): string {
  const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(', ')
  if (locale === 'hu') {
    if (!fit.top.length && !fit.against.length) return 'Kevés az adat pontos indokláshoz.'
    const parts: string[] = []
    if (fit.top.length) parts.push(`ezeket szereted: ${names(fit.top)}`)
    if (fit.against.length) parts.push(`viszont ${names(fit.against)} általában nem jön be`)
    return parts.join(' — ')
  }
  if (!fit.top.length && !fit.against.length) return 'Not enough data for a precise reason.'
  const parts: string[] = []
  if (fit.top.length) parts.push(`you like these: ${names(fit.top)}`)
  if (fit.against.length) parts.push(`but ${names(fit.against)} usually is not your thing`)
  return parts.join(' — ')
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/fit-reason.test.ts`
Expected: PASS, 4 teszt

- [ ] **Step 5: Commit**

```bash
git add src/lib/fit-reason.ts src/lib/fit-reason.test.ts
git commit -m "feat(taste): lokalis indoklas a fit-vektorbol (fit-reason)"
```

---

## Task 9: `seasonal` lokálisra

**Files:**
- Modify: `src/app/api/news/season-scores/route.ts`, `src/app/api/news/upcoming/route.ts`

**Interfaces:**
- Consumes: `buildTasteVector`, `computeFit` (Task 6); `fitReason` (Task 8); `titleFeatureKeys` (Task 1); `tasteSignal` (Task 2)
- Produces: ugyanaz a válasz-alak (`{ scores: [{ anilistId, score, reason }] }`), AI-hívás nélkül

**Ez a legnagyobb megtakarítás:** a News-betöltéshez kötött, tehát ez fut a legtöbbet.

- [ ] **Step 1: Kérd le a tageket is a szezon-listához**

🔴 A `fetchSeason` ma **nem hozza a tageket** — a `SEASON_QUERY` csak `genres`-t kér.
Enélkül a lokális pontozás a jelöltek felét vakon nézné (a vektor a tageken a legerősebb).

Modify `src/lib/anilist.ts` — a `SEASON_QUERY` `media` blokkjába vedd fel:

```graphql
        tags { name rank }
```

és a `SeasonMedia` típusba, valamint a mapper-be a `tags: m.tags ?? []` mezőt.

- [ ] **Step 2: Írd át a pontozó ágat**

Modify `src/app/api/news/season-scores/route.ts` — a `try` blokk tartalma a
`glmChat(buildSeasonMessages(...))`-tól a `sort`-ig cserélendő.

A meglévő változónevek: `rows` = a user anime-sorai, `candidates` = a szezon címei,
`titleById` = anilistId → cím. Ezeket ne nevezd át.

```typescript
    const signals = await db.select({
      feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
    }).from(tasteSignal).where(eq(tasteSignal.userId, userId))
    const vector = buildTasteVector(rows, signals)
    const locale = await userLocale(userId)

    const items: StoredScore[] = candidates
      .map((c) => {
        const fit = computeFit(vector, { genres: c.genres, tags: c.tags ?? [] })
        return fit
          ? { anilistId: c.anilistId, title: titleById.get(c.anilistId)!, score: fit.score, reason: fitReason(fit, locale) }
          : null
      })
      .filter((s): s is StoredScore => s !== null)
      .sort((a, b) => b.score - a.score)
```

Az `await consumeAiQuota(userId, 'season-scores')` sor **törlendő** — ez az út nem fogyaszt kvótát.
A cache-írás maradjon: a szezon-lekérés (`fetchSeason`) továbbra is külső hálózati hívás.

A `catch`-ág negatív cache-e maradhat, de mostantól csak a `fetchSeason` hibáját fedi.

Ugyanez a minta a `upcoming/route.ts`-ben, ahol a jelölt-változó neve `pre`.

- [ ] **Step 2: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 3: Commit**

```bash
git add src/app/api/news/season-scores/route.ts src/app/api/news/upcoming/route.ts
git commit -m "feat(taste): szezon-pontozas lokalisan, AI-hivas nelkul"
```

---

## Task 10: `recommend` lokálisra + „Mondd el bővebben"

**Files:**
- Create: `src/app/api/recommend/explain/route.ts`
- Modify: `src/app/api/recommend/route.ts`, `src/lib/candidates.ts`, `src/lib/candidates.test.ts`, `src/components/RecommendMorph.tsx`

**Interfaces:**
- Consumes: `buildTasteVector`, `computeFit`, `fitReason`, `tasteSignal`
- Produces: `POST /api/recommend` AI nélkül; `POST /api/recommend/explain` egy hívással

- [ ] **Step 1: Rangsorolj a fit-vektorral**

Modify `src/app/api/recommend/route.ts` — a `rankCandidates(...)` és az azt követő
`glmChat(buildRecommendMessages(...))` helyére:

```typescript
  const signals = await db.select({
    feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
  }).from(tasteSignal).where(eq(tasteSignal.userId, userId))
  const vector = buildTasteVector(items, signals)

  const result = candidates
    .map((c) => {
      const fit = computeFit(vector, { genres: c.genres, tags: c.tags ?? [] })
      return fit ? { ...c, score: fit.score, reason: fitReason(fit, locale) } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
```

A `consumeAiQuota(userId, 'recommend')` sor törlendő. A `recommendations` cache-írás maradhat.

- [ ] **Step 2: Vezesd ki a gyengébb modellt**

A `src/lib/candidates.ts`-ből törlendő a `genreWeights` és a `rankCandidates`; a fájl
üresen marad, tehát **magát a fájlt és a `candidates.test.ts`-t is töröld**.

Run: `rg -n "genreWeights|rankCandidates" src`
Expected: nincs találat

- [ ] **Step 3: „Mondd el bővebben" végpont**

Create `src/app/api/recommend/explain/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { tasteMemory } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { userLocale } from '@/lib/user-locale'
import { consumeAiQuota } from '@/lib/ai-quota'
import { buildRecommendMessages, parsePicks } from '@/lib/recommend'
import { glmChat } from '@/lib/glm'
import { aiUserErrorMessage } from '@/lib/ai-error'
import { eq } from 'drizzle-orm'

// Egyetlen AI-hivas IGENYRE: a mar lokalisan kivalasztott ajanlasokhoz ir prozat.
// A rangsort NEM valtoztatja meg — az a fit-vektor dolga.
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const picks = Array.isArray(body?.picks) ? body.picks : []
  if (!picks.length) return NextResponse.json({ error: 'picks kötelező' }, { status: 400 })

  try {
    await consumeAiQuota(userId, 'recommend')
    const factRows = await db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId))
    const facts = factRows.map((f) => ({ kind: f.kind, text: f.text, title: null }))
    const raw = await glmChat(
      buildRecommendMessages(picks, facts, [], await userLocale(userId)),
      { userId, endpoint: 'recommend-explain' },
    )
    return NextResponse.json({ picks: parsePicks(raw) })
  } catch (e) {
    return NextResponse.json({ error: aiUserErrorMessage(e) }, { status: 502 })
  }
}
```

- [ ] **Step 4: Gomb a felületen**

Modify `src/components/RecommendMorph.tsx` — állapot és gomb az eredménylista alá:

```tsx
  const [explaining, setExplaining] = useState(false)
  const [explainNote, setExplainNote] = useState('')

  async function explain() {
    setExplaining(true); setExplainNote('')
    try {
      const res = await fetch('/api/recommend/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: picks.map((p) => ({ anilistId: p.anilistId, title: p.title })) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setExplainNote(json?.error ?? 'Most nem sikerült bővebb indoklás'); return }
      const byId = new Map<number, string>(
        (json.picks as { anilistId: number; reason: string }[]).map((p) => [p.anilistId, p.reason]),
      )
      // a LISTA nem valtozik, csak az indoklas szovege — AI-hiba sosem tunteti el a talalatokat
      setPicks((prev) => prev.map((p) => ({ ...p, reason: byId.get(p.anilistId) ?? p.reason })))
    } finally {
      setExplaining(false)
    }
  }
```

A lista alá:

```tsx
  <button onClick={explain} disabled={explaining} className="btn-ghost px-3 py-1.5 text-xs">
    {explaining ? '…' : 'Mondd el bővebben'}
  </button>
  {explainNote && <p className="text-xs text-text-3 mt-1">{explainNote}</p>}
```

A `picks` állapotnak `setPicks`-szel frissíthetőnek kell lennie; ha ma csak
`const [picks, setPicks] = useState(...)` néven van, akkor változatlan, egyébként
vezesd be. **A találatok AI-hiba esetén is a helyükön maradnak.**

- [ ] **Step 5: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 6: Commit**

```bash
git add src/app/api/recommend src/lib/candidates.ts src/lib/candidates.test.ts src/components/RecommendMorph.tsx
git commit -m "feat(taste): recommend lokalis rangsorral, AI-proza csak gombra"
```

---

## Task 11: `vibe` chip-leképezés

**Files:**
- Modify: `src/lib/vibe-presets.ts`, `src/lib/vibe-presets.test.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `chipFeatureKeys(ids: string[]): { keys: string[]; unmapped: string[] }`

A chipek ma **szabad szöveges promptot** építenek (`buildVibePrompt`), nem feature-kulcsokat.
A 8 csoportból 6 leképezhető a katalógusra; a `Hangulat` (5 chip) és a `Tempó` (2 chip)
viszont **nem** — ezekre az AniList-nek nincs megfelelője.

- [ ] **Step 1: Írd meg a bukó tesztet**

A `src/lib/vibe-presets.test.ts` végére:

```typescript
import { chipFeatureKeys } from './vibe-presets'

describe('chipFeatureKeys', () => {
  it('mufaj-chip mufaj-kulcsot ad', () => {
    expect(chipFeatureKeys(['g-scifi']).keys).toContain('g:sci-fi')
  })
  it('hossz- es korszak-chip a szarmaztatott tengelyekre kepez', () => {
    expect(chipFeatureKeys(['len-short']).keys).toContain('length:short')
    expect(chipFeatureKeys(['len-movie']).keys).toContain('format:movie')
    expect(chipFeatureKeys(['era-2010s']).keys).toContain('era:2010s')
  })
  it('tema-chip AniList-tagre kepez', () => {
    expect(chipFeatureKeys(['th-timetravel']).keys).toContain('t:time manipulation')
  })
  it('a hangulat es tempo NEM kepezheto — unmapped-be kerul', () => {
    const out = chipFeatureKeys(['mood-dark', 'pace-fast', 'g-action'])
    expect(out.keys).toEqual(['g:action'])
    expect(out.unmapped.sort()).toEqual(['mood-dark', 'pace-fast'])
  })
  it('ismeretlen id nem dob', () => {
    expect(chipFeatureKeys(['nincs-ilyen']).unmapped).toEqual(['nincs-ilyen'])
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/vibe-presets.test.ts`
Expected: FAIL — `chipFeatureKeys` nincs exportálva

- [ ] **Step 3: Írd meg a leképezést**

Modify `src/lib/vibe-presets.ts` — a `VIBE_PRESETS` alá:

```typescript
// Chip → katalógus-feature. A Hangulat és a Tempó csoport SZÁNDÉKOSAN hiányzik:
// ezekre az AniList-nek nincs megfelelője, tehát nem pontozhatók lokálisan.
const CHIP_FEATURES: Record<string, string> = {
  'g-action': 'g:action', 'g-romance': 'g:romance', 'g-comedy': 'g:comedy',
  'g-drama': 'g:drama', 'g-fantasy': 'g:fantasy', 'g-scifi': 'g:sci-fi',
  'g-sol': 'g:slice of life', 'g-thriller': 'g:thriller',

  'len-movie': 'format:movie', 'len-short': 'length:short',
  'len-normal': 'length:standard', 'len-long': 'length:long',

  'era-classic': 'era:1990s', 'era-2000s': 'era:2000s',
  'era-2010s': 'era:2010s', 'era-fresh': 'era:2020s',

  'set-school': 't:school', 'set-fantasy': 't:isekai', 'set-space': 't:space',
  'set-historical': 't:historical', 'set-city': 't:urban fantasy',

  'th-revenge': 't:revenge', 'th-sport': 'g:sports', 'th-music': 't:music',
  'th-psych': 't:psychological', 'th-mecha': 't:mecha', 'th-isekai': 't:isekai',
  'th-timetravel': 't:time manipulation', 'th-martial': 't:martial arts',

  'demo-shounen': 't:shounen', 'demo-seinen': 't:seinen',
  'demo-shoujo': 't:shoujo', 'demo-josei': 't:josei',
}

export function chipFeatureKeys(ids: string[]): { keys: string[]; unmapped: string[] } {
  const keys: string[] = []
  const unmapped: string[] = []
  for (const id of ids) {
    const key = CHIP_FEATURES[id]
    if (key) keys.push(key)
    else unmapped.push(id)
  }
  return { keys: [...new Set(keys)], unmapped }
}
```

A `Forrás` csoport chipjei az `src/lib/vibe-presets.ts` végén vannak; azokat is vedd fel
`source:adaptation` illetve `source:original` kulcsokkal, a `titleFeatureKeys`
`sourceMedium` logikájával összhangban.

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/vibe-presets.test.ts`
Expected: PASS, 5 teszt

- [ ] **Step 5: Commit**

```bash
git add src/lib/vibe-presets.ts src/lib/vibe-presets.test.ts
git commit -m "feat(taste): vibe chip -> katalogus-feature lekepezes"
```

---

## Task 12: `vibe` lokális rangsor

**Files:**
- Modify: `src/app/api/vibe/route.ts`, `src/app/vibe/page.tsx`

**Interfaces:**
- Consumes: `chipFeatureKeys` (Task 11); `buildTasteVector`, `computeFit` (Task 6); `fitReason` (Task 8)
- Produces: chip-only kérésnél AI-hívás nélküli válasz

- [ ] **Step 1: A kliens küldje a chip-id-kat is**

Modify `src/app/vibe/page.tsx` — a POST törzsébe a `prompt` mellé `chipIds: [...chips]`.
A `prompt` továbbra is menjen (az AI-ág használja).

- [ ] **Step 2: Lokális ág a route-ban**

Modify `src/app/api/vibe/route.ts` — a `try` blokk elejére, a `consumeAiQuota` **elé**:

```typescript
  const chipIds: string[] = Array.isArray(body?.chipIds) ? body.chipIds : []
  const { keys, unmapped } = chipFeatureKeys(chipIds)
  // Lokalis ut CSAK akkor, ha nincs szabad szoveg ES minden chip lekepezheto.
  // Hangulat/tempo chipnel marad a modell — azokra nincs katalogus-megfeleloje.
  const localOnly = !prompt.trim() && keys.length > 0 && unmapped.length === 0

  if (localOnly) {
    const [signals, catalog] = await Promise.all([
      db.select({
        feature: tasteSignal.feature, polarity: tasteSignal.polarity, strength: tasteSignal.strength,
      }).from(tasteSignal).where(eq(tasteSignal.userId, userId)),
      db.select({
        anilistId: title.anilistId, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
        genres: title.genres, tags: title.tags, year: title.year, description: title.description,
      }).from(title)
        .where(and(eq(title.mediaType, 'ANIME'), isNotNull(title.coverUrl)))
        .orderBy(desc(title.popularity)).limit(500),
    ])
    const vector = buildTasteVector(rows, signals)
    const ownedAnilist = new Set(rows.map((r) => r.anilistId))

    const newPicks = catalog
      .filter((c) => !ownedAnilist.has(c.anilistId))
      .map((c) => {
        const fit = computeFit(vector, { genres: c.genres, tags: c.tags, extraKeys: keys })
        return fit ? {
          score: fit.score,
          pick: {
            title: c.titleRomaji, reason: fitReason(fit, locale), anilistId: c.anilistId,
            coverUrl: c.coverUrl, year: c.year, genres: c.genres, description: c.description,
          },
        } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.pick)

    return NextResponse.json({ ownPicks: [], newPicks })
  }
```

A `score` csak a rendezéshez kell, a válaszba nem megy — a `{ ownPicks, newPicks }`
alaknak bitre egyeznie kell a maival, különben a `/vibe` oldal nem tudja megjeleníteni.

- [ ] **Step 3: Ellenőrzés és commit**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`

```bash
git add src/app/api/vibe/route.ts src/app/vibe/page.tsx
git commit -m "feat(taste): vibe lokalis rangsor lekepezheto chipeknel"
```

---

## Task 13: Záró ellenőrzés, mérés, dokumentáció

**Files:**
- Modify: `docs/FUNKCIOK.md`, `docs/DEPLOY.md`

- [ ] **Step 1: Teljes zöld futás**

Állítsd le a dev-szervert (a `next build` és a `next dev` közös `.next`-et használ), majd:

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0 && npm run build`
Expected: minden zöld

- [ ] **Step 2: Prod-smoke**

Run: `npm run start` háttérben, majd:

```bash
curl -s -o /dev/null -w "cimoldal=%{http_code}\n" http://localhost:3000/anime/one-piece-21
curl -s -o /dev/null -w "news=%{http_code}\n" http://localhost:3000/
```

Expected: `cimoldal=200` (az ISR-út nem sérülhet), `news=200` vagy `307`

- [ ] **Step 3: Mérés**

```sql
SELECT endpoint, count(*) FROM ai_usage_log
WHERE created_at > now() - interval '7 days' GROUP BY endpoint ORDER BY 2 DESC;
```

Jegyezd fel az átállás előtti és utáni értékeket — a `season-scores`, `recommend` és `vibe`
sorainak érdemben le kell esniük, az `opinion` (a tanulás) változatlan marad.

- [ ] **Step 4: Dokumentáció**

Modify `docs/FUNKCIOK.md` — új szakasz az ízlés-jelekről és arról, mi fut lokálisan.
Modify `docs/DEPLOY.md` — a migrációs lépések közé `migrate-taste-signal.mjs`, utána
egyszeri `backfill-taste-signals.mjs`.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: izles-jelek es lokalis rangsor dokumentalasa"
```

---

## Végrehajtás utáni teendők (user)

1. Prod-migráció: `DATABASE_URL="<prod>" node scripts/migrate-taste-signal.mjs`
2. Egyszeri backfill: `DATABASE_URL="<prod>" node scripts/backfill-taste-signals.mjs`
3. Deploy, majd egy hét múlva az `ai_usage_log` összevetése a 3. lépésben feljegyzett alapértékkel
