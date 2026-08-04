# Promó videó (Remotion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Egy 28 másodperces, 9:16-os angol nyelvű promó klip az Anime Graphról Remotionnel, amely a fit-score és a népszerűségi sorrend különbségét teszi látvánnyá.

**Architecture:** Különálló npm-projekt (`C:\Users\konig\anime-graph-promo`), amely soha nem fut az anime-graph buildjében. A prod API-ból lehúzott valódi adat JSON-ba kerül, a borítók és a képernyőfelvételek helyi fájlokba, és a Remotion-kompozíció ezekből épül. Minden számoló logika (időzítési rács, sorrend-leképezés, elrendezés) tiszta függvény, vitesttel fedve; a vizuális minőséget kontakt-lapos emberi checkpoint őrzi.

**Tech Stack:** Remotion 4, React 19, TypeScript, zod, vitest, Playwright (felvételhez és kontakt-laphoz), Node 20+.

## Global Constraints

- Projekt helye: `C:\Users\konig\anime-graph-promo`. Az `anime-graph` repóba semmilyen kód nem kerül, csak a spec és ez a terv.
- Videó-paraméterek: 28 mp, 840 frame, 30 fps. Fő kompozíció 1080×1920.
- Minden képernyőn megjelenő szöveg **angol**. A terv és a commitok nyelve magyar illetve angol a commit-konvenció szerint.
- Titok nem kerül verziókövetésbe. A prod session-cookie kizárólag `.env.local`-ban él, amely gitignore-olt.
- A `data/season.json`, `public/covers/`, `public/frames/` és `out/` gitignore-olt: nagy binárisok, a szkriptekből újratermelhetők.
- Nincs futásidejű import az anime-graph kódbázisából. A design-tokenek kézzel átmásolt értékek.
- Node 22.6+ szükséges a natív TypeScript-futtatáshoz. A fejlesztői gépen
  Node 26.1 van, ahol a `node script.ts` külön flag nélkül fut, ezért a
  szkriptek nem használnak `--experimental-strip-types` kapcsolót.

---

### Task 1: Projekt-váz és időzítési rács

A teljes idővonal egyetlen forrásból származik: BPM és FPS. Így a zenesáv cseréjekor egy szám átírása elég. Ez a legelső task, mert minden jelenet ettől függ.

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\package.json`
- Create: `C:\Users\konig\anime-graph-promo\tsconfig.json`
- Create: `C:\Users\konig\anime-graph-promo\vitest.config.ts`
- Create: `C:\Users\konig\anime-graph-promo\remotion.config.ts`
- Create: `C:\Users\konig\anime-graph-promo\.gitignore`
- Create: `C:\Users\konig\anime-graph-promo\src\timing.ts`
- Test: `C:\Users\konig\anime-graph-promo\src\timing.test.ts`

**Interfaces:**
- Consumes: semmi.
- Produces:
  - `FPS: 30`, `BPM: 120`, `DURATION_FRAMES: 840`
  - `framesPerBeat(): number`
  - `type SceneName = 'hook' | 'setup' | 'reorder' | 'proof' | 'scale' | 'cta'`
  - `SCENES: Record<SceneName, { from: number; durationInFrames: number }>`
  - `CHECK_FRAMES: number[]`

- [ ] **Step 1: Mappa és függőségek**

```powershell
New-Item -ItemType Directory -Force C:\Users\konig\anime-graph-promo
Set-Location C:\Users\konig\anime-graph-promo
git init
npm init -y
npm i remotion@4 @remotion/cli@4 @remotion/zod-types@4 react react-dom zod
npm i -D typescript @types/react @types/react-dom @types/node vitest playwright
npx playwright install chromium
```

- [ ] **Step 2: Konfigurációs fájlok**

`package.json` — a `scripts` blokkot írd felül erre (a `name`, `version` maradhat):

```json
{
  "type": "module",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "test": "vitest run",
    "pull": "node scripts/pull-data.ts",
    "covers": "node scripts/fetch-covers.ts",
    "capture": "node scripts/capture.ts",
    "sheet": "node scripts/contact-sheet.ts",
    "render": "remotion render src/index.ts Promo9x16 out/promo-9x16.mp4"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "scripts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
```

`remotion.config.ts`:

```ts
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
```

`.gitignore`:

```
node_modules/
out/
.env.local
data/season.json
public/covers/
public/frames/
```

- [ ] **Step 3: Írd meg a bukó tesztet**

`src/timing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BPM, CHECK_FRAMES, DURATION_FRAMES, FPS, SCENES, framesPerBeat } from './timing.ts'

describe('timing grid', () => {
  it('egy ütem 2 másodperc 120 BPM-en, 4/4-ben', () => {
    expect(BPM).toBe(120)
    expect(FPS).toBe(30)
    expect(framesPerBeat()).toBe(60)
  })

  it('a jelenetek hézag és átfedés nélkül töltik ki a 840 frame-et', () => {
    const order = ['hook', 'setup', 'reorder', 'proof', 'scale', 'cta'] as const
    let cursor = 0
    for (const name of order) {
      expect(SCENES[name].from).toBe(cursor)
      cursor += SCENES[name].durationInFrames
    }
    expect(cursor).toBe(DURATION_FRAMES)
    expect(DURATION_FRAMES).toBe(840)
  })

  it('minden jelenethatár legalább fél-ütem határra esik', () => {
    // A setup 1,5 ütem hosszú, ezért a rács fél-ütemes, nem egész-ütemes.
    for (const scene of Object.values(SCENES)) {
      expect(scene.from % (framesPerBeat() / 2)).toBe(0)
    }
  })

  it('a hős-jelenet a leghosszabb tétel a záró bizonyítékon kívül', () => {
    expect(SCENES.reorder.durationInFrames).toBe(180)
    expect(SCENES.proof.durationInFrames).toBe(210)
  })

  it('nyolc ellenőrzési képkocka van, mind a tartományon belül', () => {
    expect(CHECK_FRAMES).toHaveLength(8)
    for (const f of CHECK_FRAMES) {
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(DURATION_FRAMES)
    }
  })
})
```

- [ ] **Step 4: Futtasd, győződj meg róla, hogy bukik**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./timing.ts"`

- [ ] **Step 5: Minimális implementáció**

`src/timing.ts`:

```ts
export const FPS = 30
export const BPM = 120

/** Egy ütem = 4 negyed 120 BPM-en = 2 másodperc = 60 frame. */
export function framesPerBeat(): number {
  return Math.round((60 / BPM) * 4 * FPS)
}

const BEAT = 60

export type SceneName = 'hook' | 'setup' | 'reorder' | 'proof' | 'scale' | 'cta'

/** Ütemekben megadott hosszak; a beat sheet 14 ütemet oszt ki. */
const BEATS: Record<SceneName, number> = {
  hook: 1,
  setup: 1.5,
  reorder: 3,
  proof: 3.5,
  scale: 3,
  cta: 2,
}

function build(): Record<SceneName, { from: number; durationInFrames: number }> {
  const out = {} as Record<SceneName, { from: number; durationInFrames: number }>
  let cursor = 0
  for (const [name, beats] of Object.entries(BEATS) as [SceneName, number][]) {
    const durationInFrames = beats * BEAT
    out[name] = { from: cursor, durationInFrames }
    cursor += durationInFrames
  }
  return out
}

export const SCENES = build()

export const DURATION_FRAMES = Object.values(SCENES)
  .reduce((sum, s) => sum + s.durationInFrames, 0)

/** Kontakt-lapra kerülő képkockák: jelenetenként legalább egy jellemző pillanat. */
export const CHECK_FRAMES = [30, 90, 200, 330, 420, 560, 700, 820]
```

- [ ] **Step 6: Futtasd, győződj meg róla, hogy zöld**

Run: `npm test`
Expected: PASS, 5 teszt.

A jelenethatárok: 0, 60, 150, 330, 540, 720. A `setup` 1,5 ütemes hossza miatt
az utolsó négy határ fél-ütemre esik, ezért vizsgál a teszt `framesPerBeat() / 2`
maradékot.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts remotion.config.ts .gitignore src/timing.ts src/timing.test.ts
git commit -m "feat: project scaffold and BPM-derived timing grid"
```

---

### Task 2: Adat-lehúzás és életképességi kapu

Ez a projekt döntési pontja. Ha a fit-score sorrend nem tér el láthatóan a népszerűségitől, a hős-jelenet lapos lesz, és a kreatív irányon változtatni kell **még a jelenetek megírása előtt**.

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\src\data\types.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\data\merge.ts`
- Test: `C:\Users\konig\anime-graph-promo\src\data\merge.test.ts`
- Create: `C:\Users\konig\anime-graph-promo\scripts\pull-data.ts`
- Create: `C:\Users\konig\anime-graph-promo\.env.local` (gitignore-olt)

**Interfaces:**
- Consumes: semmi a Task 1-ből.
- Produces:
  - `type PromoItem = { anilistId: number; title: string; coverUrl: string; coverFile: string; popRank: number; fitRank: number; fitScore: number; reason: string }`
  - `mergeSeasonData(media: BrowseMedia[], scores: ScoreItem[]): PromoItem[]`
  - `divergence(items: PromoItem[]): number`
  - `topMover(items: PromoItem[]): PromoItem`

**Háttér a valódi API-król** (ellenőrizve az anime-graph forrásában):

- `GET /api/browse?season=current&type=ANIME&sort=POPULARITY_DESC` → `{ total: number, media: Row[] }`. A `media` a katalógus `title` táblájának sorai, népszerűség szerint rendezve, oldalanként 30. A **népszerűségi rangot a tömb-indexből** vesszük, nem oszlopból. Fontos: a `season` paraméter kizárólag a `current` és `next` literált fogadja el, minden más érték esetén nincs szezon-szűrés.
- `GET /api/news/season-scores` → `{ season: { season, year }, items: { anilistId, title, score, reason }[] }`. Bejelentkezést igényel, 401-et ad enélkül. Legfeljebb 30 tétel, **már pontszám szerint csökkenő sorrendben**. A `reason` lokálisan számolt determinisztikus szöveg (`fitReason`), nem modellhívás. Üres tömböt ad, ha a fióknak nincs saját anime-sora.
- A két halmaz **nem azonos forrásból** jön: a browse a helyi katalógusból, a season-scores az AniList szezon-listájából. Összefésülés `anilistId`-n, a metszet lehet kisebb mindkettőnél.

- [ ] **Step 1: Írd meg a bukó tesztet**

`src/data/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { divergence, mergeSeasonData, topMover } from './merge.ts'

const media = [
  { anilistId: 1, titleRomaji: 'Alpha', coverUrl: 'https://cdn/1.jpg' },
  { anilistId: 2, titleRomaji: 'Beta', coverUrl: 'https://cdn/2.jpg' },
  { anilistId: 3, titleRomaji: 'Gamma', coverUrl: 'https://cdn/3.jpg' },
  { anilistId: 4, titleRomaji: 'Delta', coverUrl: null },
]

const scores = [
  { anilistId: 3, title: 'Gamma', score: 91, reason: 'psychological drama' },
  { anilistId: 1, title: 'Alpha', score: 70, reason: 'shounen action' },
  { anilistId: 2, title: 'Beta', score: 55, reason: 'slice of life' },
  { anilistId: 9, title: 'Ghost', score: 99, reason: 'nincs a katalógusban' },
]

describe('mergeSeasonData', () => {
  it('csak a metszetet tartja meg, borító nélküli címet kihagy', () => {
    const items = mergeSeasonData(media, scores)
    expect(items.map((i) => i.anilistId).sort()).toEqual([1, 2, 3])
  })

  it('a népszerűségi rangot a browse tömb-indexéből veszi, nullától', () => {
    const items = mergeSeasonData(media, scores)
    expect(items.find((i) => i.anilistId === 1)!.popRank).toBe(0)
    expect(items.find((i) => i.anilistId === 3)!.popRank).toBe(2)
  })

  it('a fit-rangot a pontszám szerint adja, a metszeten újraszámolva', () => {
    const items = mergeSeasonData(media, scores)
    expect(items.find((i) => i.anilistId === 3)!.fitRank).toBe(0)
    expect(items.find((i) => i.anilistId === 2)!.fitRank).toBe(2)
  })

  it('determinisztikus, borítófájl-nevet ad', () => {
    const items = mergeSeasonData(media, scores)
    expect(items.find((i) => i.anilistId === 1)!.coverFile).toBe('covers/1.jpg')
  })

  it('popRank szerint rendezve ad vissza', () => {
    const items = mergeSeasonData(media, scores)
    expect(items.map((i) => i.popRank)).toEqual([0, 1, 2])
  })
})

describe('divergence', () => {
  it('nulla, ha a két sorrend azonos', () => {
    const same = mergeSeasonData(media, [
      { anilistId: 1, title: 'Alpha', score: 90, reason: 'r' },
      { anilistId: 2, title: 'Beta', score: 80, reason: 'r' },
      { anilistId: 3, title: 'Gamma', score: 70, reason: 'r' },
    ])
    expect(divergence(same)).toBe(0)
  })

  it('teljes megfordításnál 1-hez közeli', () => {
    const reversed = mergeSeasonData(media, [
      { anilistId: 3, title: 'Gamma', score: 90, reason: 'r' },
      { anilistId: 2, title: 'Beta', score: 80, reason: 'r' },
      { anilistId: 1, title: 'Alpha', score: 70, reason: 'r' },
    ])
    expect(divergence(reversed)).toBeGreaterThan(0.5)
  })
})

describe('topMover', () => {
  it('a legnagyobbat előrelépő címet adja, nem a legmagasabb pontszámút', () => {
    const items = mergeSeasonData(media, scores)
    expect(topMover(items).anilistId).toBe(3)
  })
})
```

- [ ] **Step 2: Futtasd, győződj meg róla, hogy bukik**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./merge.ts"`

- [ ] **Step 3: Implementáció**

`src/data/types.ts`:

```ts
export type BrowseMedia = {
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
}

export type ScoreItem = {
  anilistId: number
  title: string
  score: number
  reason: string
}

export type PromoItem = {
  anilistId: number
  title: string
  coverUrl: string
  coverFile: string
  popRank: number
  fitRank: number
  fitScore: number
  reason: string
}
```

`src/data/merge.ts`:

```ts
import type { BrowseMedia, PromoItem, ScoreItem } from './types.ts'

/**
 * A két végpont más forrásból jön (katalógus kontra AniList szezon-lista),
 * ezért csak a metszet használható. Borító nélküli cím kiesik: a videó
 * kizárólag borítókból épül, üres kártyának nincs helye.
 */
export function mergeSeasonData(media: BrowseMedia[], scores: ScoreItem[]): PromoItem[] {
  const scoreById = new Map(scores.map((s) => [s.anilistId, s]))

  const withPop = media
    .map((m, index) => ({ media: m, popRank: index }))
    .filter((x) => x.media.coverUrl !== null && scoreById.has(x.media.anilistId))

  // A fit-rang a metszeten belül értelmes, nem az eredeti 30-as listán.
  const fitOrder = [...withPop]
    .sort((a, b) => scoreById.get(b.media.anilistId)!.score - scoreById.get(a.media.anilistId)!.score)
    .map((x) => x.media.anilistId)

  return withPop.map((x) => {
    const score = scoreById.get(x.media.anilistId)!
    return {
      anilistId: x.media.anilistId,
      title: x.media.titleRomaji,
      coverUrl: x.media.coverUrl!,
      coverFile: `covers/${x.media.anilistId}.jpg`,
      popRank: x.popRank,
      fitRank: fitOrder.indexOf(x.media.anilistId),
      fitScore: score.score,
      reason: score.reason,
    }
  })
}

/**
 * Átlagos normalizált rang-eltolódás, 0 és 1 között. Ez dönti el, hogy az
 * átrendeződés-animáció látványos lesz-e. 0,25 alatt a klip hős-pillanata
 * gyakorlatilag mozdulatlan.
 */
export function divergence(items: PromoItem[]): number {
  if (items.length < 2) return 0
  const maxShift = items.length - 1
  const total = items.reduce((sum, i) => sum + Math.abs(i.popRank - i.fitRank), 0)
  return total / (items.length * maxShift)
}

/** A legnagyobb előrelépés, azaz a hős-kártya jelöltje. */
export function topMover(items: PromoItem[]): PromoItem {
  return items.reduce((best, i) =>
    i.popRank - i.fitRank > best.popRank - best.fitRank ? i : best)
}
```

- [ ] **Step 4: Futtasd, győződj meg róla, hogy zöld**

Run: `npm test`
Expected: PASS, 13 teszt összesen (5 timing + 8 merge).

- [ ] **Step 5: Lehúzó szkript**

`.env.local` (a tulajdonos tölti ki, a böngésző DevTools → Application → Cookies alól):

```
PROMO_BASE_URL=https://anime-graph.vercel.app
PROMO_COOKIE=session=...
```

`scripts/pull-data.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { divergence, mergeSeasonData, topMover } from '../src/data/merge.ts'
import type { BrowseMedia, ScoreItem } from '../src/data/types.ts'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const base = env.PROMO_BASE_URL
const cookie = env.PROMO_COOKIE
if (!base || !cookie) throw new Error('PROMO_BASE_URL és PROMO_COOKIE kötelező a .env.local-ban')

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { headers: { cookie } })
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

const browse = await get<{ media: BrowseMedia[] }>(
  '/api/browse?season=current&type=ANIME&sort=POPULARITY_DESC',
)
const scored = await get<{ season: { season: string; year: number }; items: ScoreItem[] }>(
  '/api/news/season-scores',
)

if (scored.items.length === 0) {
  throw new Error(
    'A season-scores üres. Vagy nincs bejelentkezve a cookie, vagy a fióknak nincs értékelt animéje.',
  )
}

const items = mergeSeasonData(browse.media, scored.items)
mkdirSync('data', { recursive: true })
writeFileSync('data/season.json', JSON.stringify({ season: scored.season, items }, null, 2))

const d = divergence(items)
const mover = topMover(items)

console.log(`szezon:        ${scored.season.season} ${scored.season.year}`)
console.log(`browse:        ${browse.media.length} cím`)
console.log(`pontozott:     ${scored.items.length} cím`)
console.log(`metszet:       ${items.length} cím`)
console.log(`divergencia:   ${d.toFixed(3)}  (0,25 alatt lapos lenne az animáció)`)
console.log(`hős-jelölt:    ${mover.title}  pop #${mover.popRank + 1} → fit #${mover.fitRank + 1}, score ${mover.fitScore}`)
console.log(`indoklása:     ${JSON.stringify(mover.reason)}`)
console.log('\nA három leghosszabb indoklás:')
for (const i of [...items].sort((a, b) => b.reason.length - a.reason.length).slice(0, 3)) {
  console.log(`  ${i.title}: ${JSON.stringify(i.reason)}`)
}
```

- [ ] **Step 6: Futtasd, és értékeld a kaput**

Run: `npm run pull`

Három dolgot kell megnézni a kimeneten, és **jelenteni a tulajdonosnak, mielőtt bármi más történne**:

1. **Metszet mérete.** 12 cím alatt a két oszlop üresnek hat. 12 alatt: emeld a browse-oldalt (`&page=2`) és fésüld össze, vagy válts `season=next`-re.
2. **Divergencia.** 0,25 felett a hős-jelenet működik. Alatta a „Két lista" irány nem áll meg a lábán, és a tulajdonossal kell egyeztetni: másik szezon, vagy váltás a spec 9. pontjában rögzített B/C irányra.
3. **Az indoklás-szövegek hossza és olvashatósága.** A spec 7 másodpercet szán rá. Ha az indoklások két-három szavas címkék (például `psychological, drama`), az a blokk nem tölthető ki egyetlen szöveggel: akkor a BIZONYÍTÉK jelenet három rövid chipre bomlik szalagcím helyett. Ezt a Task 6 kezdetén kell eldönteni.

Ne folytasd a Task 3-mal, amíg ez a három szám nincs kimondva.

- [ ] **Step 7: Commit**

```bash
git add src/data scripts/pull-data.ts
git commit -m "feat: season data merge with divergence gate"
```

---

### Task 3: Borító-letöltés

A Remotion párhuzamosan rendereli a képkockákat. Távoli AniList-CDN URL-ekkel ez rate limitbe fut, és a render nem determinisztikus.

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\scripts\fetch-covers.ts`
- Modify: `C:\Users\konig\anime-graph-promo\src\data\merge.test.ts` (nem szükséges, a `coverFile` már fedve van)

**Interfaces:**
- Consumes: `data/season.json` a Task 2-ből, `PromoItem.coverUrl` és `PromoItem.coverFile`.
- Produces: `public/covers/<anilistId>.jpg` fájlok.

- [ ] **Step 1: Szkript**

`scripts/fetch-covers.ts`:

```ts
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import type { PromoItem } from '../src/data/types.ts'

const { items } = JSON.parse(readFileSync('data/season.json', 'utf8')) as { items: PromoItem[] }
mkdirSync('public/covers', { recursive: true })

let downloaded = 0
for (const item of items) {
  const target = `public/${item.coverFile}`
  if (existsSync(target)) continue
  const res = await fetch(item.coverUrl)
  if (!res.ok) {
    console.warn(`kihagyva ${item.title}: ${res.status}`)
    continue
  }
  writeFileSync(target, Buffer.from(await res.arrayBuffer()))
  downloaded++
}
console.log(`${downloaded} új borító, összesen ${items.length} tétel`)
```

- [ ] **Step 2: Futtasd**

Run: `npm run covers`
Expected: minden tételhez fájl a `public/covers/` alatt, nulla figyelmeztetés. Ha van figyelmeztetés, az adott cím kiesik a videóból; 2-nél több kiesés esetén futtasd újra a `npm run pull`-t.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-covers.ts
git commit -m "feat: local cover download for deterministic renders"
```

---

### Task 4: Design-tokenek, alapkomponensek, HOOK jelenet, kontakt-lap

Az első képkocka, amit szemmel is látni lehet. A kontakt-lap szkript itt készül el, mert innentől minden vizuális ellenőrzés rajta megy.

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\src\theme.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\components\Glass.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\components\Caption.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\components\PosterCard.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\scenes\Hook.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\Promo.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\Root.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\index.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\schema.ts`
- Create: `C:\Users\konig\anime-graph-promo\scripts\contact-sheet.ts`

**Interfaces:**
- Consumes: `SCENES`, `DURATION_FRAMES`, `FPS`, `CHECK_FRAMES` a Task 1-ből; `PromoItem` a Task 2-ből; `public/covers/*` a Task 3-ból.
- Produces:
  - `THEME` objektum: `font`, `bg`, `text1`, `text2`, `silver`, `glass1`, `glass2`, `radius`
  - `<Glass level={1|2|3} style?>` wrapper
  - `<Caption text>` alsó harmad felirat
  - `<PosterCard item badge?>` borító-kártya
  - `promoSchema` zod séma, `PromoProps` típus
  - `Promo9x16` kompozíció-azonosító

- [ ] **Step 1: Tokenek**

`src/theme.ts` — az anime-graph liquid glass rendszeréből kézzel átemelt értékek:

```ts
export const THEME = {
  font: 'Inter, system-ui, sans-serif',
  bg: '#07080a',
  text1: 'rgba(255,255,255,0.94)',
  text2: 'rgba(255,255,255,0.62)',
  silver: '#d8dde5',
  glass1: 'rgba(255,255,255,0.045)',
  glass2: 'rgba(255,255,255,0.075)',
  hairline: '1px solid rgba(255,255,255,0.10)',
  radius: { sm: 14, md: 20, lg: 28, xl: 36 },
  shadow: '0 30px 80px rgba(0,0,0,.6)',
} as const
```

- [ ] **Step 2: Alapkomponensek**

`src/components/Glass.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react'
import { THEME } from '../theme.ts'

export function Glass({
  level = 1, style, children,
}: { level?: 1 | 2; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      style={{
        background: level === 1 ? THEME.glass1 : THEME.glass2,
        border: THEME.hairline,
        borderRadius: THEME.radius.lg,
        backdropFilter: 'blur(24px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

`src/components/Caption.tsx`:

```tsx
import { interpolate, useCurrentFrame } from 'remotion'
import { THEME } from '../theme.ts'
import { Glass } from './Glass.tsx'

/** Égetett felirat az alsó harmadban. 8 frame alatt úszik be. */
export function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  const y = interpolate(frame, [0, 8], [18, 0], { extrapolateRight: 'clamp' })

  return (
    <div style={{
      position: 'absolute', left: 60, right: 60, bottom: 220,
      display: 'flex', justifyContent: 'center', opacity, transform: `translateY(${y}px)`,
    }}>
      <Glass level={2} style={{ padding: '20px 32px', borderRadius: THEME.radius.md }}>
        <p style={{
          margin: 0, fontFamily: THEME.font, fontSize: 42, lineHeight: 1.25,
          fontWeight: 600, color: THEME.text1, textAlign: 'center', textWrap: 'balance',
        }}>
          {text}
        </p>
      </Glass>
    </div>
  )
}
```

`src/components/PosterCard.tsx`:

```tsx
import { Img, staticFile } from 'remotion'
import type { CSSProperties } from 'react'
import type { PromoItem } from '../data/types.ts'
import { THEME } from '../theme.ts'

export function PosterCard({
  item, width, dim = false, style,
}: { item: PromoItem; width: number; dim?: boolean; style?: CSSProperties }) {
  return (
    <div style={{
      width, aspectRatio: '2 / 3', borderRadius: THEME.radius.sm, overflow: 'hidden',
      border: THEME.hairline, boxShadow: THEME.shadow,
      filter: dim ? 'grayscale(1) brightness(0.55)' : 'none',
      ...style,
    }}>
      <Img src={staticFile(item.coverFile)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}
```

- [ ] **Step 3: Props-séma és gyökér**

`src/schema.ts`:

```ts
import { z } from 'zod'

export const promoItemSchema = z.object({
  anilistId: z.number(),
  title: z.string(),
  coverUrl: z.string(),
  coverFile: z.string(),
  popRank: z.number(),
  fitRank: z.number(),
  fitScore: z.number(),
  reason: z.string(),
})

export const promoSchema = z.object({
  items: z.array(promoItemSchema),
  copy: z.object({
    hook: z.string(),
    setup: z.string(),
    reorder: z.string(),
    scale: z.string(),
    ctaTitle: z.string(),
    ctaSub: z.string(),
    ctaUrl: z.string(),
  }),
})

export type PromoProps = z.infer<typeof promoSchema>

export const DEFAULT_COPY: PromoProps['copy'] = {
  hook: 'Your anime recommendations are just popularity charts.',
  setup: 'Same season. Two orders.',
  reorder: 'Ranked by your ratings. Not everyone else\u2019s.',
  scale: 'Import from MAL or AniList in 2 minutes.',
  ctaTitle: 'Anime Graph',
  ctaSub: 'Free. Bring your list.',
  ctaUrl: 'anime-graph.vercel.app',
}
```

`src/Root.tsx`:

```tsx
import { Composition } from 'remotion'
import seasonData from '../data/season.json'
import { Promo } from './Promo.tsx'
import { DEFAULT_COPY, promoSchema, type PromoProps } from './schema.ts'
import { DURATION_FRAMES, FPS } from './timing.ts'

const defaultProps: PromoProps = {
  items: seasonData.items,
  copy: DEFAULT_COPY,
}

const shared = {
  component: Promo,
  schema: promoSchema,
  defaultProps,
  durationInFrames: DURATION_FRAMES,
  fps: FPS,
} as const

export function RemotionRoot() {
  return (
    <>
      <Composition id="Promo9x16" {...shared} width={1080} height={1920} />
      <Composition id="Promo1x1" {...shared} width={1080} height={1080} />
      <Composition id="Promo16x9" {...shared} width={1920} height={1080} />
    </>
  )
}
```

`src/index.ts`:

```ts
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root.tsx'

registerRoot(RemotionRoot)
```

- [ ] **Step 4: HOOK jelenet és idővonal**

`src/scenes/Hook.tsx`:

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { PromoItem } from '../data/types.ts'
import { Caption } from '../components/Caption.tsx'
import { PosterCard } from '../components/PosterCard.tsx'
import { THEME } from '../theme.ts'

/** Teljes képet kitöltő borító-rács, lassú befelé skálázással. */
export function Hook({ items, text }: { items: PromoItem[]; text: string }) {
  const frame = useCurrentFrame()
  const { width } = useVideoConfig()
  const scale = interpolate(frame, [0, 60], [1.0, 1.08])
  const columns = 3
  const gap = 18
  const cardWidth = (width - gap * (columns + 1)) / columns

  return (
    <AbsoluteFill style={{ background: THEME.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{
        transform: `scale(${scale})`, display: 'flex', flexWrap: 'wrap',
        gap, padding: gap, alignContent: 'center', justifyContent: 'center',
      }}>
        {items.slice(0, 9).map((item) => (
          <PosterCard key={item.anilistId} item={item} width={cardWidth} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{
        background: 'linear-gradient(180deg, rgba(7,8,10,.85) 0%, rgba(7,8,10,.25) 40%, rgba(7,8,10,.92) 100%)',
      }} />
      <p style={{
        position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center', margin: 0,
        fontFamily: THEME.font, fontSize: 26, letterSpacing: '0.22em', fontWeight: 500,
        color: THEME.text2,
      }}>
        MOST POPULAR
      </p>
      <Caption text={text} />
    </AbsoluteFill>
  )
}
```

`src/Promo.tsx` — egyelőre csak a HOOK, a többi jelenet a következő taskokban kerül be:

```tsx
import { AbsoluteFill, Sequence } from 'remotion'
import { Hook } from './scenes/Hook.tsx'
import type { PromoProps } from './schema.ts'
import { SCENES } from './timing.ts'
import { THEME } from './theme.ts'

export function Promo({ items, copy }: PromoProps) {
  return (
    <AbsoluteFill style={{ background: THEME.bg }}>
      <Sequence from={SCENES.hook.from} durationInFrames={SCENES.hook.durationInFrames}>
        <Hook items={items} text={copy.hook} />
      </Sequence>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 5: Kontakt-lap szkript**

Playwrightot használ, nem ffmpeget: a Remotion 4 nem tesz ki külön ffmpeg binárist, a Playwright viszont már függőség, és natív fordítás nélkül működik.

`scripts/contact-sheet.ts`:

```ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { CHECK_FRAMES } from '../src/timing.ts'

const comp = process.argv[2] ?? 'Promo9x16'
mkdirSync('out/stills', { recursive: true })

for (const f of CHECK_FRAMES) {
  const out = `out/stills/${comp}-${f}.png`
  if (existsSync(out) && process.argv.includes('--reuse')) continue
  execFileSync(
    'npx',
    ['remotion', 'still', 'src/index.ts', comp, out, `--frame=${f}`, '--scale=0.5'],
    { stdio: 'inherit', shell: true },
  )
}

const cells = CHECK_FRAMES.map((f) => `
  <figure>
    <img src="file://${resolve(`out/stills/${comp}-${f}.png`).replace(/\\/g, '/')}" />
    <figcaption>frame ${f}</figcaption>
  </figure>`).join('')

const html = `<html><body style="margin:0;background:#111;font:14px monospace;color:#aaa">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px">${cells}</div>
<style>figure{margin:0}img{width:100%;display:block;border:1px solid #333}figcaption{padding:4px 0}</style>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.setContent(html)
await page.locator('div').first().screenshot({ path: `out/contact-${comp}.png` })
await browser.close()
console.log(`kész: out/contact-${comp}.png`)
```

- [ ] **Step 6: Nézd meg élőben**

Run: `npm run studio`
Expected: a Remotion Studio megnyílik, a `Promo9x16` első 60 frame-je a borító-rácsot és a feliratot mutatja. A 60. frame után fekete, mert a többi jelenet még nincs meg.

Ha a borítók nem jelennek meg: a `staticFile()` a `public/` mappához képest old fel, tehát a `coverFile` értéke `covers/123.jpg` kell legyen, `public/` előtag nélkül. Ezt a Task 2 `mergeSeasonData` függvénye adja így.

- [ ] **Step 7: Commit**

```bash
git add src scripts/contact-sheet.ts
git commit -m "feat: theme tokens, base components, hook scene, contact sheet"
```

---

### Task 5: SETUP és ÁTRENDEZŐDÉS jelenet

A klip hős-pillanata. A pozíciók adatból számolódnak, nem kézzel animáltak, így szezonváltáskor magától újrahangolódik.

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\src\layout.ts`
- Test: `C:\Users\konig\anime-graph-promo\src\layout.test.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\components\FitBadge.tsx`
- Create: `C:\Users\konig\anime-graph-promo\src\scenes\Split.tsx`
- Modify: `C:\Users\konig\anime-graph-promo\src\Promo.tsx`

**Interfaces:**
- Consumes: `PromoItem`, `THEME`, `PosterCard`, `Caption`, `SCENES`.
- Produces:
  - `splitLayout(width: number, height: number, rows: number): { cardWidth: number; rowHeight: number; leftX: number; rightX: number; topY: number }`
  - `rowY(rank: number, layout: ReturnType<typeof splitLayout>): number`
  - `staggerDelay(rank: number): number`
  - `<FitBadge score={number} progress={number} />`

- [ ] **Step 1: Írd meg a bukó tesztet**

`src/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { rowY, splitLayout, staggerDelay } from './layout.ts'

describe('splitLayout', () => {
  it('portréban két oszlop fér el a képszélességben, hézaggal', () => {
    const l = splitLayout(1080, 1920, 5)
    expect(l.cardWidth).toBeGreaterThan(380)
    expect(l.leftX + l.cardWidth).toBeLessThanOrEqual(l.rightX)
    expect(l.rightX + l.cardWidth).toBeLessThanOrEqual(1080)
  })

  it('fekvőben a kártyák kisebbek, mert a magasság a szűk keresztmetszet', () => {
    const portrait = splitLayout(1080, 1920, 5)
    const landscape = splitLayout(1920, 1080, 5)
    expect(landscape.cardWidth).toBeLessThan(portrait.cardWidth)
  })

  it('a sorok elférnek a képmagasságban', () => {
    const l = splitLayout(1080, 1920, 5)
    expect(l.topY + l.rowHeight * 5).toBeLessThanOrEqual(1920)
  })
})

describe('rowY', () => {
  it('a rangokat egyenletes sorokba képezi', () => {
    const l = splitLayout(1080, 1920, 5)
    expect(rowY(0, l)).toBe(l.topY)
    expect(rowY(2, l)).toBe(l.topY + l.rowHeight * 2)
  })
})

describe('staggerDelay', () => {
  it('nulla az elsőnek, és rangonként nő', () => {
    expect(staggerDelay(0)).toBe(0)
    expect(staggerDelay(3)).toBeGreaterThan(staggerDelay(1))
  })

  it('az utolsó kártya is elindul a jelenet első harmadában', () => {
    expect(staggerDelay(7)).toBeLessThan(60)
  })
})
```

- [ ] **Step 2: Futtasd, győződj meg róla, hogy bukik**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./layout.ts"`

- [ ] **Step 3: Implementáció**

`src/layout.ts`:

```ts
const GAP = 24
const LABEL_SPACE = 190

export function splitLayout(width: number, height: number, rows: number) {
  // Két oszlop a szélességben, a sorok a magasságban. A kisebbik korlát dönt,
  // ezért fekvőben magától kisebb kártyát kapunk.
  const byWidth = (width - GAP * 3) / 2
  const byHeight = ((height - LABEL_SPACE - GAP * (rows + 1)) / rows) * (2 / 3)
  const cardWidth = Math.floor(Math.min(byWidth, byHeight))
  const rowHeight = Math.floor((cardWidth * 3) / 2 + GAP)

  return {
    cardWidth,
    rowHeight,
    leftX: Math.floor((width - cardWidth * 2 - GAP) / 2),
    rightX: Math.floor((width - cardWidth * 2 - GAP) / 2 + cardWidth + GAP),
    topY: LABEL_SPACE,
  }
}

export function rowY(rank: number, layout: { topY: number; rowHeight: number }): number {
  return layout.topY + layout.rowHeight * rank
}

/** Lépcsőzetes indítás: a felső kártyák előbb mozdulnak, a szem így követni tudja. */
export function staggerDelay(rank: number): number {
  return rank * 6
}
```

- [ ] **Step 4: Futtasd, győződj meg róla, hogy zöld**

Run: `npm test`
Expected: PASS, 19 teszt.

- [ ] **Step 5: FitBadge komponens**

`src/components/FitBadge.tsx`:

```tsx
import { THEME } from '../theme.ts'

/** progress: 0..1, ennyire számolt fel a szám. */
export function FitBadge({ score, progress }: { score: number; progress: number }) {
  const shown = Math.round(score * progress)
  return (
    <div style={{
      position: 'absolute', right: -10, top: -10,
      minWidth: 74, padding: '8px 12px', borderRadius: 999,
      background: 'rgba(7,8,10,0.82)', border: THEME.hairline,
      backdropFilter: 'blur(12px)', textAlign: 'center',
      opacity: progress === 0 ? 0 : 1,
    }}>
      <span style={{
        fontFamily: THEME.font, fontSize: 30, fontWeight: 700,
        color: THEME.silver, fontVariantNumeric: 'tabular-nums',
      }}>
        {shown}
      </span>
    </div>
  )
}
```

- [ ] **Step 6: Split jelenet**

`src/scenes/Split.tsx` — ugyanaz a komponens szolgálja a SETUP és az ÁTRENDEZŐDÉS blokkot. A `phase` prop dönti el, hogy a jobb oszlop még a népszerűségi sorrendben áll-e.

```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { PromoItem } from '../data/types.ts'
import { Caption } from '../components/Caption.tsx'
import { FitBadge } from '../components/FitBadge.tsx'
import { PosterCard } from '../components/PosterCard.tsx'
import { rowY, splitLayout, staggerDelay } from '../layout.ts'
import { THEME } from '../theme.ts'

const ROWS = 5

function ColumnLabel({ x, width, text, muted }: { x: number; width: number; text: string; muted: boolean }) {
  return (
    <p style={{
      position: 'absolute', left: x, width, top: 110, margin: 0, textAlign: 'center',
      fontFamily: THEME.font, fontSize: 24, letterSpacing: '0.2em', fontWeight: 600,
      color: muted ? THEME.text2 : THEME.silver,
    }}>
      {text}
    </p>
  )
}

export function Split({
  items, text, animate,
}: { items: PromoItem[]; text: string; animate: boolean }) {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const layout = splitLayout(width, height, ROWS)

  const byPop = [...items].sort((a, b) => a.popRank - b.popRank).slice(0, ROWS)

  return (
    <AbsoluteFill style={{ background: THEME.bg }}>
      <ColumnLabel x={layout.leftX} width={layout.cardWidth} text="POPULAR" muted />
      <ColumnLabel x={layout.rightX} width={layout.cardWidth} text="YOU" muted={!animate} />

      {byPop.map((item, index) => (
        <PosterCard
          key={`l-${item.anilistId}`}
          item={item}
          width={layout.cardWidth}
          dim
          style={{ position: 'absolute', left: layout.leftX, top: rowY(index, layout) }}
        />
      ))}

      {byPop.map((item, index) => {
        // A cél-sor a fit-rang, de csak a látott 5 címen belül értelmezve.
        const targetRank = byPop
          .slice()
          .sort((a, b) => a.fitRank - b.fitRank)
          .findIndex((x) => x.anilistId === item.anilistId)

        const progress = animate
          ? spring({
              frame: frame - staggerDelay(index),
              fps,
              config: { damping: 16, mass: 0.9 },
            })
          : 0

        const y = interpolate(progress, [0, 1], [rowY(index, layout), rowY(targetRank, layout)])
        const badge = animate
          ? interpolate(frame, [40, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
          : 0

        return (
          <div key={`r-${item.anilistId}`} style={{ position: 'absolute', left: layout.rightX, top: y }}>
            <PosterCard item={item} width={layout.cardWidth} dim={!animate} />
            <FitBadge score={item.fitScore} progress={badge} />
          </div>
        )
      })}

      <Caption text={text} />
    </AbsoluteFill>
  )
}
```

- [ ] **Step 7: Kösd be az idővonalba**

`src/Promo.tsx` — a `Hook` sequence után:

```tsx
      <Sequence from={SCENES.setup.from} durationInFrames={SCENES.setup.durationInFrames}>
        <Split items={items} text={copy.setup} animate={false} />
      </Sequence>
      <Sequence from={SCENES.reorder.from} durationInFrames={SCENES.reorder.durationInFrames}>
        <Split items={items} text={copy.reorder} animate />
      </Sequence>
```

Az importot is add hozzá: `import { Split } from './scenes/Split.tsx'`

- [ ] **Step 8: Vizuális ellenőrzés**

Run: `npm run sheet`
Expected: `out/contact-Promo9x16.png` elkészül. A 90. és a 200. frame cellája a lényeg: a 90-nél két azonos, szürke oszlop áll, a 200-nál a jobb oszlop már átrendeződött és a jelvényeken számok vannak.

**Checkpoint:** mutasd meg a kontakt-lapot a tulajdonosnak, és kérj ítéletet, mielőtt a Task 6 elkezdődik. Ez a terv redo-féke.

- [ ] **Step 9: Commit**

```bash
git add src/layout.ts src/layout.test.ts src/components/FitBadge.tsx src/scenes/Split.tsx src/Promo.tsx
git commit -m "feat: split columns and data-driven reorder animation"
```

---

### Task 6: BIZONYÍTÉK jelenet

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\src\scenes\Proof.tsx`
- Modify: `C:\Users\konig\anime-graph-promo\src\Promo.tsx`
- Modify: `C:\Users\konig\anime-graph-promo\src\schema.ts`

**Interfaces:**
- Consumes: `topMover` a Task 2-ből, `PosterCard`, `FitBadge`, `Glass`, `THEME`.
- Produces: `<Proof items reasonMode />` ahol `reasonMode: 'sentence' | 'chips'`.

- [ ] **Step 1: Döntsd el a szöveg-módot**

Nézd meg a Task 2 hatodik lépésében kiírt indoklás-mintákat.

- Ha a leghosszabb indoklás **60 karakternél hosszabb** és mondatszerű: `reasonMode = 'sentence'`.
- Ha rövid, vesszővel tagolt címkék: `reasonMode = 'chips'`, és a szöveg vesszőnél darabolva, chipenként jelenik meg.

Ez a döntés a `DEFAULT_COPY` mellé kerül propként, hogy render időben is váltható legyen.

`src/schema.ts` — a `promoSchema` objektumába vedd fel:

```ts
  reasonMode: z.enum(['sentence', 'chips']).default('sentence'),
```

- [ ] **Step 2: Jelenet**

`src/scenes/Proof.tsx`:

```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { topMover } from '../data/merge.ts'
import type { PromoItem } from '../data/types.ts'
import { FitBadge } from '../components/FitBadge.tsx'
import { Glass } from '../components/Glass.tsx'
import { PosterCard } from '../components/PosterCard.tsx'
import { THEME } from '../theme.ts'

export function Proof({
  items, reasonMode,
}: { items: PromoItem[]; reasonMode: 'sentence' | 'chips' }) {
  const frame = useCurrentFrame()
  const { width, fps } = useVideoConfig()
  const hero = topMover(items)

  const rise = spring({ frame, fps, config: { damping: 18 } })
  const cardWidth = interpolate(rise, [0, 1], [width * 0.4, width * 0.56])
  const reveal = interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const chips = hero.reason.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 3)

  return (
    <AbsoluteFill style={{
      background: THEME.bg, alignItems: 'center', justifyContent: 'center', gap: 48,
    }}>
      <div style={{ position: 'relative' }}>
        <PosterCard item={hero} width={cardWidth} />
        <FitBadge score={hero.fitScore} progress={1} />
      </div>

      <div style={{ opacity: reveal, transform: `translateY(${interpolate(reveal, [0, 1], [16, 0])}px)` }}>
        <p style={{
          margin: '0 0 18px', textAlign: 'center', fontFamily: THEME.font,
          fontSize: 40, fontWeight: 700, color: THEME.text1,
        }}>
          {hero.title}
        </p>

        {reasonMode === 'sentence' ? (
          <Glass level={1} style={{ padding: '22px 30px', maxWidth: width * 0.78 }}>
            <p style={{
              margin: 0, fontFamily: THEME.font, fontSize: 32, lineHeight: 1.35,
              color: THEME.text2, textAlign: 'center',
            }}>
              {hero.reason}
            </p>
          </Glass>
        ) : (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {chips.map((chip, i) => (
              <Glass
                key={chip}
                level={2}
                style={{
                  padding: '14px 22px', borderRadius: 999,
                  opacity: interpolate(frame, [40 + i * 12, 58 + i * 12], [0, 1], {
                    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                  }),
                }}
              >
                <span style={{ fontFamily: THEME.font, fontSize: 30, color: THEME.text1 }}>{chip}</span>
              </Glass>
            ))}
          </div>
        )}

        <p style={{
          margin: '22px 0 0', textAlign: 'center', fontFamily: THEME.font,
          fontSize: 26, color: THEME.text2,
        }}>
          {`popularity #${hero.popRank + 1}  \u2192  your rank #${hero.fitRank + 1}`}
        </p>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 3: Idővonal**

`src/Promo.tsx`:

```tsx
      <Sequence from={SCENES.proof.from} durationInFrames={SCENES.proof.durationInFrames}>
        <Proof items={items} reasonMode={reasonMode} />
      </Sequence>
```

A `Promo` propjai közé vedd fel a `reasonMode`-ot, és importáld a `Proof`-ot.

- [ ] **Step 4: Ellenőrzés**

Run: `npm run sheet`
Expected: a 420. frame cellájában a hős-kártya középen, alatta a cím, az indoklás és a rang-váltás sora.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/Proof.tsx src/Promo.tsx src/schema.ts
git commit -m "feat: proof scene with hero card and fit reason"
```

---

### Task 7: Képernyőfelvétel és MÉRET jelenet

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\scripts\capture.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\components\FrameSequence.tsx`
- Test: `C:\Users\konig\anime-graph-promo\src\components\frame-index.test.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\frame-index.ts`
- Create: `C:\Users\konig\anime-graph-promo\src\scenes\Scale.tsx`
- Modify: `C:\Users\konig\anime-graph-promo\src\Promo.tsx`

**Interfaces:**
- Consumes: `THEME`, `Caption`.
- Produces:
  - `frameFile(dir: string, index: number, total: number): string`
  - `<FrameSequence dir total />`

- [ ] **Step 1: Írd meg a bukó tesztet**

`src/frame-index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { frameFile } from './frame-index.ts'

describe('frameFile', () => {
  it('négyjegyű, nullával feltöltött nevet ad', () => {
    expect(frameFile('graph', 0, 45)).toBe('frames/graph/0000.png')
    expect(frameFile('graph', 12, 45)).toBe('frames/graph/0012.png')
  })

  it('a tartomány végén megáll, nem fut túl', () => {
    expect(frameFile('graph', 90, 45)).toBe('frames/graph/0044.png')
  })

  it('negatív indexet nullára szorít', () => {
    expect(frameFile('graph', -5, 45)).toBe('frames/graph/0000.png')
  })
})
```

- [ ] **Step 2: Futtasd, győződj meg róla, hogy bukik**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./frame-index.ts"`

- [ ] **Step 3: Implementáció**

`src/frame-index.ts`:

```ts
/** A felvett PNG-sorozat egy képkockájának útvonala a public/ mappához képest. */
export function frameFile(dir: string, index: number, total: number): string {
  const clamped = Math.min(Math.max(index, 0), total - 1)
  return `frames/${dir}/${String(clamped).padStart(4, '0')}.png`
}
```

`src/components/FrameSequence.tsx`:

```tsx
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import { frameFile } from '../frame-index.ts'

export function FrameSequence({ dir, total }: { dir: string; total: number }) {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(frameFile(dir, frame, total))}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  )
}
```

- [ ] **Step 4: Futtasd, győződj meg róla, hogy zöld**

Run: `npm test`
Expected: PASS, 22 teszt.

- [ ] **Step 5: Felvevő szkript**

`scripts/capture.ts`:

```ts
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const base = env.PROMO_BASE_URL
const [name, value] = env.PROMO_COOKIE.split('=')

// Headed mód kötelező: a headless Chrome WebGL-kimenete a 3D gráfnál üres.
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } })
await context.addCookies([{
  name, value, domain: new URL(base).hostname, path: '/', secure: true, httpOnly: true,
}])
const page = await context.newPage()

type Shot = { dir: string; url: string; frames: number; step: (page: import('playwright').Page, i: number) => Promise<void> }

const shots: Shot[] = [
  {
    dir: 'graph', url: `${base}/graf`, frames: 45,
    // A gráf magától forog; itt csak várunk kockánként.
    step: async () => { await new Promise((r) => setTimeout(r, 33)) },
  },
  {
    dir: 'catalog', url: `${base}/bongeszo`, frames: 45,
    step: async (p) => { await p.mouse.wheel(0, 24); await new Promise((r) => setTimeout(r, 33)) },
  },
  {
    dir: 'wrapped', url: `${base}/wrapped`, frames: 30,
    step: async () => { await new Promise((r) => setTimeout(r, 33)) },
  },
]

for (const shot of shots) {
  mkdirSync(`public/frames/${shot.dir}`, { recursive: true })
  await page.goto(shot.url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  for (let i = 0; i < shot.frames; i++) {
    await page.screenshot({ path: `public/frames/${shot.dir}/${String(i).padStart(4, '0')}.png` })
    await shot.step(page, i)
  }
  console.log(`${shot.dir}: ${shot.frames} kocka`)
}

await browser.close()
```

- [ ] **Step 6: Futtasd és nézd át**

Run: `npm run capture`
Expected: három mappa a `public/frames/` alatt, összesen 120 PNG.

Nyisd meg a `public/frames/graph/0022.png` fájlt. Ha fekete vagy üres, a WebGL nem rajzolt: növeld a `waitForTimeout` értékét 6000-re, és futtasd újra. Ha úgy is üres, a felvételt kézzel kell megcsinálni OBS-sel, és a videót képkockákra bontani.

- [ ] **Step 7: Scale jelenet**

`src/scenes/Scale.tsx`:

```tsx
import { AbsoluteFill, Sequence } from 'remotion'
import { Caption } from '../components/Caption.tsx'
import { FrameSequence } from '../components/FrameSequence.tsx'
import { Glass } from '../components/Glass.tsx'
import { THEME } from '../theme.ts'

/** 180 frame három vágásban: gráf 60, katalógus 70, wrapped 50. */
export function Scale({ text }: { text: string }) {
  return (
    <AbsoluteFill style={{ background: THEME.bg }}>
      <Sequence durationInFrames={60}><FrameSequence dir="graph" total={45} /></Sequence>
      <Sequence from={60} durationInFrames={70}><FrameSequence dir="catalog" total={45} /></Sequence>
      <Sequence from={130} durationInFrames={50}><FrameSequence dir="wrapped" total={30} /></Sequence>

      <AbsoluteFill style={{
        background: 'linear-gradient(180deg, rgba(7,8,10,.55) 0%, rgba(7,8,10,0) 35%, rgba(7,8,10,.9) 100%)',
      }} />

      <Glass level={2} style={{
        position: 'absolute', top: 120, left: 60, right: 60, padding: '18px 26px', textAlign: 'center',
      }}>
        <span style={{ fontFamily: THEME.font, fontSize: 30, fontWeight: 600, color: THEME.text1 }}>
          {'22,000+ anime  \u00b7  136,000+ manga'}
        </span>
      </Glass>

      <Caption text={text} />
    </AbsoluteFill>
  )
}
```

- [ ] **Step 8: Idővonal és ellenőrzés**

`src/Promo.tsx`:

```tsx
      <Sequence from={SCENES.scale.from} durationInFrames={SCENES.scale.durationInFrames}>
        <Scale text={copy.scale} />
      </Sequence>
```

Run: `npm run sheet`
Expected: az 560. és a 700. frame cellája valódi app-felvételt mutat a stat-sávval.

- [ ] **Step 9: Commit**

```bash
git add scripts/capture.ts src/frame-index.ts src/frame-index.test.ts src/components/FrameSequence.tsx src/scenes/Scale.tsx src/Promo.tsx
git commit -m "feat: headed-chromium frame capture and scale scene"
```

---

### Task 8: CTA jelenet és arány-variánsok

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\src\scenes\Cta.tsx`
- Modify: `C:\Users\konig\anime-graph-promo\src\Promo.tsx`

**Interfaces:**
- Consumes: `copy.ctaTitle`, `copy.ctaSub`, `copy.ctaUrl`, `Glass`, `THEME`.
- Produces: teljes, 840 frame-es idővonal, három arányban renderelhetően.

- [ ] **Step 1: CTA jelenet**

`src/scenes/Cta.tsx`:

```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Glass } from '../components/Glass.tsx'
import { THEME } from '../theme.ts'

export function Cta({ title, sub, url }: { title: string; sub: string; url: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // A 40. frame után minden áll: az utolsó képkocka thumbnailként is működik.
  const rise = spring({ frame: Math.min(frame, 40), fps, config: { damping: 20 } })

  return (
    <AbsoluteFill style={{ background: THEME.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Glass level={2} style={{
        padding: '56px 64px', textAlign: 'center',
        transform: `translateY(${interpolate(rise, [0, 1], [40, 0])}px)`,
        opacity: rise,
      }}>
        <p style={{
          margin: 0, fontFamily: THEME.font, fontSize: 68, fontWeight: 800,
          letterSpacing: '-0.02em', color: THEME.silver,
        }}>
          {title}
        </p>
        <p style={{ margin: '18px 0 0', fontFamily: THEME.font, fontSize: 34, color: THEME.text2 }}>
          {sub}
        </p>
        <p style={{
          margin: '34px 0 0', fontFamily: THEME.font, fontSize: 30, fontWeight: 600,
          color: THEME.text1, letterSpacing: '0.04em',
        }}>
          {url}
        </p>
      </Glass>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 2: Teljes idővonal**

`src/Promo.tsx` végleges alakja:

```tsx
import { AbsoluteFill, Sequence } from 'remotion'
import { Cta } from './scenes/Cta.tsx'
import { Hook } from './scenes/Hook.tsx'
import { Proof } from './scenes/Proof.tsx'
import { Scale } from './scenes/Scale.tsx'
import { Split } from './scenes/Split.tsx'
import type { PromoProps } from './schema.ts'
import { SCENES } from './timing.ts'
import { THEME } from './theme.ts'

export function Promo({ items, copy, reasonMode }: PromoProps) {
  return (
    <AbsoluteFill style={{ background: THEME.bg }}>
      <Sequence from={SCENES.hook.from} durationInFrames={SCENES.hook.durationInFrames}>
        <Hook items={items} text={copy.hook} />
      </Sequence>
      <Sequence from={SCENES.setup.from} durationInFrames={SCENES.setup.durationInFrames}>
        <Split items={items} text={copy.setup} animate={false} />
      </Sequence>
      <Sequence from={SCENES.reorder.from} durationInFrames={SCENES.reorder.durationInFrames}>
        <Split items={items} text={copy.reorder} animate />
      </Sequence>
      <Sequence from={SCENES.proof.from} durationInFrames={SCENES.proof.durationInFrames}>
        <Proof items={items} reasonMode={reasonMode} />
      </Sequence>
      <Sequence from={SCENES.scale.from} durationInFrames={SCENES.scale.durationInFrames}>
        <Scale text={copy.scale} />
      </Sequence>
      <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.durationInFrames}>
        <Cta title={copy.ctaTitle} sub={copy.ctaSub} url={copy.ctaUrl} />
      </Sequence>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 3: Ellenőrzés mindhárom arányban**

```powershell
npm run sheet
npm run sheet -- Promo1x1
npm run sheet -- Promo16x9
```

Expected: három kontakt-lap. A `Promo16x9` esetén a kártyák kisebbek, de a két oszlop nem lóg ki, és a felirat nem takarja a kártyák alját. Ha kilóg, a `layout.ts` `LABEL_SPACE` értékét arányfüggővé kell tenni: fekvőben 120 legyen 190 helyett.

**Checkpoint:** teljes kontakt-lap a tulajdonosnak, mielőtt a zene bekerül.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/Cta.tsx src/Promo.tsx
git commit -m "feat: cta scene and full 840-frame timeline"
```

---

### Task 9: Zene, beat-illesztés, végrender

**Files:**
- Create: `C:\Users\konig\anime-graph-promo\public\music.mp3` (a tulajdonos adja)
- Modify: `C:\Users\konig\anime-graph-promo\src\Promo.tsx`
- Modify: `C:\Users\konig\anime-graph-promo\src\timing.ts` (csak ha a sáv BPM-je nem 120)
- Create: `C:\Users\konig\anime-graph-promo\README.md`

**Interfaces:**
- Consumes: minden korábbi.
- Produces: `out/promo-9x16.mp4`, `out/promo-1x1.mp4`, `out/promo-16x9.mp4`.

- [ ] **Step 1: Zenesáv beillesztése**

`src/Promo.tsx` — az `AbsoluteFill` első gyerekeként:

```tsx
import { Audio, staticFile } from 'remotion'
```

```tsx
      <Audio src={staticFile('music.mp3')} volume={0.85} />
```

- [ ] **Step 2: BPM-illesztés**

Ha a kapott sáv nem 120 BPM, írd át a `BPM` konstanst a `src/timing.ts`-ben, és futtasd a teszteket.

Run: `npm test`
Expected: a `timing.test.ts` első és második tesztje bukik, mert a 840 frame és a 60 frame/ütem 120 BPM-hez van rögzítve.

Ez szándékos: a teszt kényszeríti ki a tudatos döntést. Két lehetőség:

1. A klip hossza változhat: írd át a teszt `expect(DURATION_FRAMES).toBe(840)` sorát a számolt új értékre, és fogadd el a hosszváltozást.
2. A klip 28 mp marad: ne a `BPM`-et írd át, hanem a zenét vágd 120 BPM-re, vagy fogadd el, hogy a vágások nem esnek pontosan ütemre.

Ha a sáv 120 BPM, ez a lépés kimarad.

- [ ] **Step 3: Végrender mindhárom arányban**

```powershell
npx remotion render src/index.ts Promo9x16 out/promo-9x16.mp4
npx remotion render src/index.ts Promo1x1  out/promo-1x1.mp4
npx remotion render src/index.ts Promo16x9 out/promo-16x9.mp4
```

Expected: három MP4. A 9:16-os fájl 1080×1920, 28 mp, hanggal.

- [ ] **Step 4: Végignézés**

Nézd meg a `out/promo-9x16.mp4` fájlt **hang nélkül is**. A klip akkor kész, ha némán is érthető. Ha nem az, a felirat-időzítésen kell igazítani, nem a zenén.

- [ ] **Step 5: README**

`README.md`:

```markdown
# anime-graph-promo

Promó klip az Anime Graphhoz, Remotionnel. A tervet és a specet az
anime-graph repó `docs/superpowers/` mappája tartalmazza.

## Újraépítés nulláról

```powershell
npm ci
# .env.local: PROMO_BASE_URL és PROMO_COOKIE
npm run pull      # data/season.json + életképességi számok
npm run covers    # public/covers/
npm run capture   # public/frames/ (headed Chromium, ne zavard a böngészőt)
npm run render
```

## Ellenőrzés

```powershell
npm test          # tiszta függvények: időzítés, összefésülés, elrendezés
npm run sheet     # out/contact-Promo9x16.png, 8 kulcs-képkocka egy lapon
npm run studio    # élő szerkesztő
```

Az adatfájlok és a felvételek nincsenek verziókövetve, a fenti szkriptekből
újratermelhetők.
```

- [ ] **Step 6: Commit**

```bash
git add src/Promo.tsx README.md
git commit -m "feat: music track, beat alignment, render scripts"
```

---

## Self-Review

**Spec-lefedettség.** A spec 3. pontjának hat blokkja rendre a Task 4 (HOOK), Task 5 (SETUP és ÁTRENDEZŐDÉS), Task 6 (BIZONYÍTÉK), Task 7 (MÉRET), Task 8 (CTA) alatt készül el. A 4. pont projekt-elhelyezése a Task 1 első lépése. Az 5. pont adatforrása a Task 2, a 6. pont felvétele a Task 7. A 7. pont fájlszerkezete a Taskok „Files" blokkjaiban tételesen szerepel. A 8. pont kontakt-lapja a Task 4 ötödik lépése, a checkpointok a Task 5 nyolcadik és a Task 8 harmadik lépésénél. A 9. pont kockázatai közül a divergencia-kapu a Task 2 hatodik lépése, a WebGL-kockázat a Task 7 hatodik lépése, a BPM-kockázat a Task 9 második lépése.

**Eltérés a spectől, javítást igényel.** A spec a `reason` mezőt „valódi AI-indoklás"-ként írja le. A forrás szerint a `season-scores` route lokálisan számol, modellhívás nélkül. A spec 3. és 5. pontját ennek megfelelően javítani kell. Ezt a terv a Task 6 első lépésével kezeli funkcionálisan, de a spec szövege is pontosításra szorul.

**Nyitott input, amely nélkül a Task 9 nem indul.** A zenesáv. A Task 1-8 e nélkül végigvihető.
