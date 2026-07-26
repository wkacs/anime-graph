# UI-redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A béta-szintű kinézetet cover-driven kinematografikus arculatra váltani: token-réteg, primitívek, shell, és a 4 kulcsoldal (home, címoldal, `/bongeszo`, `/lista`).

**Architecture:** Alulról fölfelé. Először CSS-token réteg (`globals.css`) és a fontok — ez önmagában mind a 17 oldalon látszik. Aztán a redesign **döntési logikája tiszta függvényként `src/lib/`-be**, TDD-vel (score-szín, hero-választás, nav-csoportosítás), mert a projektben csak node-környezetű lib-teszt van. Aztán a primitívek, mindegyik a saját első fogyasztójával együtt landol. Végül a 4 oldal layout-ja, és egy záró prod-build + screenshot-kör.

**Tech Stack:** Next.js 15.5.20 (App Router), React 19, Tailwind CSS v4 (`@theme inline`, nincs `tailwind.config`), framer-motion 12, next-intl 4, vitest 4 (`environment: 'node'`), Drizzle + Neon. Nincs UI-library, és **nem is kerül be**.

## Global Constraints

- **Nincs új npm dependency.** Tailwind v4 + framer-motion + `next/font/google` elég.
- **Nincs DB-migráció, nincs séma-változás.** A poszter-szín a kép CSS blur-kópiájából jön, nem kinyert hex-értékből.
- **Dark-only.** Nincs light téma, nincs `prefers-color-scheme` ág.
- **Nincs új brand-szín.** A shell monokróm; a színt a tartalom (borító) adja.
- **`src/components/CatalogTitlePage.tsx` szerver-komponens ISR-cache-ben: NEM kerülhet bele `no-store` fetch, `cookies()`, `headers()` vagy `getTranslations()`.** Ez a 2026-07-25-i P0 volt (minden címoldal 500: `DYNAMIC_SERVER_USAGE`), és **`next dev`-ben nem reprodukálódik**. A címoldal szekció-címkéi statikus magyar szövegek maradnak.
- **A meglévő CSS-osztályok nem törölhetők**: `.glass`, `.glass-strong`, `.label-mono`, `.field`, `.btn-ghost`, `.btn-solid`, `.no-scrollbar`, `.cta-glow`, `@keyframes fadeUp`, `@keyframes ctaGlow`. 13 oldal használja őket, amelyek nincsenek a scope-ban. Definíciójuk átvezethető az új tokenekre, de a **név és a látvány marad**.
- **Vitest**: `environment: 'node'`, `include: ['src/**/*.test.ts']` — csak `.ts`. `.tsx` tesztet **ne** írj, nem futna le. Komponens-logikát lib-be kell kiemelni, ha tesztelni kell.
- **Commit-üzenet**: conventional prefix, magyar szöveg ékezet nélkül (a repo szokása, pl. `feat(taste): vibe lokalis rangsor lekepezheto chipeknel`). Minden commit végén:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Push és Vercel-deploy nincs a scope-ban** — az a useren.
- **A `stash@{0}`** (liquid-glass home WIP) nem kerül vissza, nem kerül hozzá.
- Minden `npm`/`git` parancs a repo gyökeréből fut: `C:\Users\konig\OneDrive\Dokumentumok\GitHub\anime-graph`.

---

### Task 1: Baseline, ág, token-réteg

**Files:**
- Modify: `src/app/globals.css` (teljes átírás, 146 sor → új)
- Modify: `src/app/layout.tsx:1-53`

**Interfaces:**
- Consumes: semmit (első task)
- Produces: CSS-osztályok és custom property-k, amelyekre minden későbbi task épít:
  - Osztályok: `.display-xl`, `.display-l`, `.h2`, `.surface-1`, `.surface-2`, `.surface-3`, `.poster-ambient`, `.poster-glow`, `.hairline`
  - Property-k: `--sp-1..24`, `--r-sm|md|lg|xl`, `--fs-display-xl|display-l|h2|body|eyebrow`, `--ease-out`, `--surface-{1,2,3}-{bg,border,highlight}`
  - Tailwind-utility a `@theme inline`-ból: `font-display`, `font-jp` (a meglévő `font-sans`, `font-mono`, `text-text-1|2|3` mellé)
  - Font CSS-változó: `--font-instrument-serif`

- [ ] **Step 1: Baseline rögzítése — teszt-darabszám kódváltozás ELŐTT**

```bash
npm test 2>&1 | tail -20
```

Írd le a kapott `Tests  N passed (N)` számot. Ez a baseline; a terv végén ennyinek vagy többnek kell zöldnek lennie. Ha itt bármi piros, **állj meg és jelentsd** — nem a redesign törte el.

- [ ] **Step 2: Ág létrehozása**

```bash
git checkout -b feature/ui-redesign
git status --short
```

Expected: üres output (tiszta tree), és `git branch --show-current` → `feature/ui-redesign`.

- [ ] **Step 3: `src/app/globals.css` teljes átírása**

Írd felül a fájlt ezzel a tartalommal:

```css
@import "tailwindcss";

:root {
  /* ── alap ─────────────────────────────────────────────── */
  --bg: #09090b;
  --text-1: #fafafa;
  --text-2: #a1a1aa;
  --text-3: #6b6b74;

  /* ── felület-skála ────────────────────────────────────── */
  --surface-1-bg: rgba(255, 255, 255, 0.03);
  --surface-1-border: rgba(255, 255, 255, 0.07);
  --surface-2-bg: rgba(255, 255, 255, 0.055);
  --surface-2-border: rgba(255, 255, 255, 0.1);
  --surface-2-highlight: rgba(255, 255, 255, 0.16);
  --surface-3-bg: rgba(255, 255, 255, 0.095);
  --surface-3-border: rgba(255, 255, 255, 0.14);
  --surface-3-highlight: rgba(255, 255, 255, 0.22);

  /* legacy aliasok: a 13 nem átírt oldal .glass/.glass-strong-ot használ */
  --glass-bg: var(--surface-2-bg);
  --glass-bg-strong: var(--surface-3-bg);
  --glass-border: var(--surface-2-border);
  --glass-highlight: var(--surface-2-highlight);

  /* ── status-színek (hangolva: ne kiabáljanak a poszterek mellett) ── */
  --status-completed: #fafafa;
  --status-watching: #7fd8ad;
  --status-planned: #8a8f98;
  --status-dropped: #d98a8a;

  /* ── térköz (4px alap) ────────────────────────────────── */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.25rem;
  --sp-6: 1.5rem;
  --sp-8: 2rem;
  --sp-10: 2.5rem;
  --sp-12: 3rem;
  --sp-16: 4rem;
  --sp-20: 5rem;
  --sp-24: 6rem;

  /* ── rádiusz ──────────────────────────────────────────── */
  --r-sm: 0.5rem;
  --r-md: 0.875rem;
  --r-lg: 1.25rem;
  --r-xl: 1.75rem;

  /* ── tipográfiai skála ────────────────────────────────── */
  --fs-display-xl: clamp(2.75rem, 6vw, 4.5rem);
  --fs-display-l: clamp(2rem, 4vw, 3rem);
  --fs-h2: 1.5rem;
  --fs-body: 0.875rem;
  --fs-eyebrow: 0.6875rem;

  /* ── mozgás ───────────────────────────────────────────── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

@theme inline {
  --color-text-1: var(--text-1);
  --color-text-2: var(--text-2);
  --color-text-3: var(--text-3);
  --font-sans: var(--font-instrument), var(--font-noto-jp), sans-serif;
  --font-mono: var(--font-geist-mono), monospace;
  --font-display: var(--font-instrument-serif), Georgia, serif;
  --font-jp: var(--font-noto-jp), sans-serif;
}

html {
  color-scheme: dark;
}

body {
  color: var(--text-1);
  font-family: var(--font-instrument), var(--font-noto-jp), Arial, sans-serif;
  /* ambient fény + vignetta a szélekre — a vignetta a 3. réteg */
  background:
    radial-gradient(1200px 800px at 50% -10%, rgba(255, 255, 255, 0.045), transparent 60%),
    radial-gradient(900px 600px at 8% 105%, rgba(255, 255, 255, 0.028), transparent 58%),
    radial-gradient(140% 100% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.55) 100%),
    var(--bg);
  background-attachment: fixed;
}

/* filmszemcse mindenen: 2,5%-on nem zavar, de kiveszi a „flat CSS" érzést.
   pointer-events:none miatt a 3D-gráf interakcióját sem fogja el. */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.025;
  background-size: 120px 120px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ── tipográfiai fokozatok ───────────────────────────────── */

.display-xl {
  font-family: var(--font-instrument-serif), Georgia, serif;
  font-size: var(--fs-display-xl);
  font-weight: 400;
  line-height: 0.95;
  letter-spacing: -0.02em;
}

.display-l {
  font-family: var(--font-instrument-serif), Georgia, serif;
  font-size: var(--fs-display-l);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: -0.015em;
}

.h2 {
  font-family: var(--font-instrument-serif), Georgia, serif;
  font-size: var(--fs-h2);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
}

/* ── felület-skála ───────────────────────────────────────── */

.surface-1 {
  background: var(--surface-1-bg);
  border: 1px solid var(--surface-1-border);
}

.surface-2 {
  background: var(--surface-2-bg);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid var(--surface-2-border);
  box-shadow:
    inset 0 1px 0 0 var(--surface-2-highlight),
    0 8px 32px rgba(0, 0, 0, 0.45);
}

.surface-3 {
  background: var(--surface-3-bg);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid var(--surface-3-border);
  box-shadow:
    inset 0 1px 0 0 var(--surface-3-highlight),
    0 12px 40px rgba(0, 0, 0, 0.55);
}

/* KÖTELEZŐ aliasok: 13 nem átírt oldal használja őket. Név és látvány marad. */
.glass {
  background: var(--surface-2-bg);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid var(--surface-2-border);
  box-shadow:
    inset 0 1px 0 0 var(--surface-2-highlight),
    0 8px 32px rgba(0, 0, 0, 0.45);
}

.glass-strong {
  background: var(--surface-3-bg);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid var(--surface-3-border);
  box-shadow:
    inset 0 1px 0 0 var(--surface-3-highlight),
    0 12px 40px rgba(0, 0, 0, 0.55);
}

.hairline {
  border: 1px solid var(--surface-1-border);
}

/* ── poszter-ambiens: a cover-driven irány motorja ───────── */

/* blur-kópia a tartalom alatt; a <img> gyerek adja a színt */
.poster-ambient {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.poster-ambient > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.15);
  filter: blur(64px) saturate(180%);
  opacity: 0.42;
}

.poster-ambient[data-intensity="card"] > img {
  filter: blur(28px) saturate(170%);
  opacity: 0.5;
}

.poster-ambient[data-intensity="row"] > img {
  filter: blur(18px) saturate(160%);
  opacity: 0.35;
}

/* hover-izzás: a kártya alatt a saját borító színe.
   Az opacitást a fogyasztó állítja (Tailwind group-hover), itt csak a szűrő. */
.poster-glow {
  position: absolute;
  inset: 8% 4% -6% 4%;
  z-index: -1;
  filter: blur(24px) saturate(180%);
  transition: opacity 320ms var(--ease-out);
  pointer-events: none;
}

/* ── eyebrow: apró uppercase mono címke. MEGMARAD, de lefokozva:
   csak a valódi szekció-cím FÖLÉ, nem helyette. ─────────── */
.label-mono {
  font-family: var(--font-geist-mono), monospace;
  font-size: var(--fs-eyebrow);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

/* ── form-elemek ─────────────────────────────────────────── */

.field {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: var(--r-sm);
  color: var(--text-1);
  outline: none;
  transition: border-color 150ms var(--ease-out), background 150ms var(--ease-out);
}
.field:focus {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.07);
}
.field::placeholder {
  color: var(--text-3);
}

.btn-ghost {
  border-radius: 9999px;
  color: var(--text-2);
  transition: color 150ms var(--ease-out), background 150ms var(--ease-out);
}
.btn-ghost:hover {
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.07);
}

.btn-solid {
  border-radius: 9999px;
  background: var(--text-1);
  color: #0c0c0e;
  font-weight: 600;
  transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out);
}
.btn-solid:hover {
  opacity: 0.88;
}
.btn-solid:disabled {
  opacity: 0.35;
}

.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* vízszintes snap-sáv (stáb, karakterek) */
.snap-row {
  display: flex;
  gap: var(--sp-4);
  overflow-x: auto;
  scroll-snap-type: x proximity;
}
.snap-row > * {
  scroll-snap-align: start;
  flex: 0 0 auto;
}

/* ── animációk (meglévők megtartva) ──────────────────────── */

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

@keyframes ctaGlow {
  0%, 100% { box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.22), 0 0 16px rgba(250, 250, 250, 0.08); }
  50% { box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.22), 0 0 30px rgba(250, 250, 250, 0.2); }
}
.cta-glow {
  animation: ctaGlow 3.4s ease-in-out infinite;
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}

*:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: `src/app/layout.tsx` — display-font regisztrálása**

Az `Instrument_Serif` **nem variable font**: a `weight` megadása kötelező, különben a build elhasal.

Módosítsd a fájl elejét (`layout.tsx:1-21`):

```tsx
import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import IntlProvider from "@/components/IntlProvider";
import TopNav from "@/components/TopNav";
import "./globals.css";

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

// display-vágás: NEM variable font, a weight kötelező
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "500"],
  subsets: ["latin"],
});
```

És a `<body>` className-jét (`layout.tsx:43-45`):

```tsx
      <body
        className={`${instrument.variable} ${instrumentSerif.variable} ${geistMono.variable} ${notoJp.variable} antialiased`}
      >
```

- [ ] **Step 5: Típus- és teszt-ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
```

Expected: `tsc` 0 hiba; a teszt-darabszám azonos a Step 1 baseline-jával (CSS és font nem érint lib-logikát).

- [ ] **Step 6: Prod-build — az egyetlen kapu, ami az ISR-hibát elkapja**

```bash
npm run build
```

Expected: `✓ Compiled successfully`, és a route-lista végigfut hiba nélkül. Ha `DATABASE_URL` miatt hasal el, a `.env.local` jelen van és tartalmazza — env-probléma, nem kód; jelentsd.

- [ ] **Step 7: Vizuális ellenőrzés — nézd meg, ne csak feltételezd**

```bash
npm run dev
```

Playwright MCP-vel (`browser_navigate`, `browser_resize`, `browser_take_screenshot`) nyisd meg `http://localhost:3000/` és `http://localhost:3000/lista` oldalt 1440×900-on, és **tekintsd meg a képeket**. Amit látni kell: a `<h1>`-ek még mindig sans (a `.display-*` osztályokat még senki nem használja), de a háttéren ott a vignetta és a szemcse. Ha a lap észrevehetően szürkébb/zajosabb lett — jó. Ha a szemcse látható mintázatként kiabál, vedd `opacity: 0.02`-re.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): token-reteg — felulet-skala, tipo-skala, szemcse, poszter-ambiens

Instrument Serif display-vagas, 4px terkoz-skala, radiusz- es tipo-tokenek,
surface-1/2/3 skala a .glass egyetlen szintje helyett, filmszemcse +
vignetta a lapon, .poster-ambient/.poster-glow primitiv osztalyok.
A .glass/.glass-strong/.label-mono nev es latvany valtozatlan: 13 oldal
hasznalja, amelyek nincsenek a scope-ban.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `scoreColor` lib + `ScoreBadge` primitív

Ma **négy** helyen van egymástól függetlenül másolt badge-jelölés két különböző színküszöbbel. Egy helyre kerül, és mivel ez döntési logika, TDD-vel.

**Files:**
- Create: `src/lib/score-color.ts`
- Create: `src/lib/score-color.test.ts`
- Create: `src/components/ui/ScoreBadge.tsx`
- Modify: `src/lib/use-fit-scores.ts:29-33` (a `fitColor` törlése)
- Modify: `src/app/page.tsx:12` (import), `:406-422`, `:466-470`, `:511-519`
- Modify: `src/app/bongeszo/page.tsx:5` (import), `:148-152`
- Modify: `src/app/vs/page.tsx:291-293`

**Interfaces:**
- Consumes: Task 1 osztályai (`.surface-2`) és a `--status-*` tokenek
- Produces:
  - `scoreColor(score: number, kind?: ScoreKind): string` — CSS-színérték
  - `type ScoreKind = 'fit' | 'taste'`
  - `SCORE_THRESHOLDS: Record<ScoreKind, { high: number; mid: number }>`
  - `<ScoreBadge score={number} kind?={ScoreKind} suffix?={string} title?={string} />` React-komponens

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/score-color.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreColor, SCORE_THRESHOLDS } from './score-color'

describe('scoreColor', () => {
  it('fit: a high kuszob felett zold', () => {
    expect(scoreColor(70, 'fit')).toBe('var(--status-watching)')
    expect(scoreColor(99, 'fit')).toBe('var(--status-watching)')
  })

  it('fit: a mid es high kozott semleges', () => {
    expect(scoreColor(45, 'fit')).toBe('var(--text-1)')
    expect(scoreColor(69, 'fit')).toBe('var(--text-1)')
  })

  it('fit: a mid alatt piros', () => {
    expect(scoreColor(44, 'fit')).toBe('var(--status-dropped)')
    expect(scoreColor(0, 'fit')).toBe('var(--status-dropped)')
  })

  it('taste: magasabb kuszobok mint a fit-nel', () => {
    expect(scoreColor(74, 'taste')).toBe('var(--text-1)')
    expect(scoreColor(75, 'taste')).toBe('var(--status-watching)')
    expect(scoreColor(49, 'taste')).toBe('var(--status-dropped)')
  })

  it('kind nelkul fit az alapertelmezes', () => {
    expect(scoreColor(70)).toBe(scoreColor(70, 'fit'))
    expect(scoreColor(50)).toBe(scoreColor(50, 'fit'))
  })

  it('a hatarokon kivuli ertekek nem dobnak', () => {
    expect(scoreColor(-10)).toBe('var(--status-dropped)')
    expect(scoreColor(1000)).toBe('var(--status-watching)')
  })

  it('minden kind-nak van kuszobe es high > mid', () => {
    for (const kind of ['fit', 'taste'] as const) {
      const t = SCORE_THRESHOLDS[kind]
      expect(t.high).toBeGreaterThan(t.mid)
    }
  })
})
```

- [ ] **Step 2: Futtasd — buknia kell**

```bash
npx vitest run src/lib/score-color.test.ts
```

Expected: FAIL — `Failed to resolve import "./score-color"`.

- [ ] **Step 3: Minimális implementáció**

Create `src/lib/score-color.ts`:

```ts
// Egy szinskala minden pontszam-badge-hez. Korabban negy helyen volt
// egymastol fuggetlenul masolva, ket kulonbozo kuszobbel.
export type ScoreKind = 'fit' | 'taste'

export const SCORE_THRESHOLDS: Record<ScoreKind, { high: number; mid: number }> = {
  // lokalis fit-becsles: engedobb, mert becsles
  fit: { high: 70, mid: 45 },
  // AI-taste pontszam: szigorubb, mert kevesebb es megfontoltabb
  taste: { high: 75, mid: 50 },
}

export function scoreColor(score: number, kind: ScoreKind = 'fit'): string {
  const { high, mid } = SCORE_THRESHOLDS[kind]
  if (score >= high) return 'var(--status-watching)'
  if (score >= mid) return 'var(--text-1)'
  return 'var(--status-dropped)'
}
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

```bash
npx vitest run src/lib/score-color.test.ts
```

Expected: PASS, 7 teszt.

- [ ] **Step 5: `ScoreBadge` komponens**

Create `src/components/ui/ScoreBadge.tsx`:

```tsx
import { scoreColor, type ScoreKind } from '@/lib/score-color'

type Props = {
  score: number
  kind?: ScoreKind
  /** pl. '%' a lokalis fit-nel; a taste-pontszam suffix nelkul all */
  suffix?: string
  title?: string
}

// Pontszam-badge a poszter jobb felso sarkaba. A szint a scoreColor donti el.
export default function ScoreBadge({ score, kind = 'fit', suffix = '', title }: Props) {
  return (
    <span
      className="surface-2 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
      style={{ color: scoreColor(score, kind) }}
      title={title}
    >
      {score}{suffix}
    </span>
  )
}
```

- [ ] **Step 6: `fitColor` törlése és a 4 hívási hely cseréje**

`src/lib/use-fit-scores.ts` — töröld a `fitColor` függvényt (`:29-33`). A `useFitScores` marad változatlanul.

`src/app/page.tsx:12` — cseréld:
```tsx
import { useFitScores } from '@/lib/use-fit-scores'
import ScoreBadge from '@/components/ui/ScoreBadge'
```

`src/app/page.tsx:406-422` — a `badge={...}` kifejezés helyére:
```tsx
                badge={s.tasteScore != null ? (
                  <ScoreBadge score={s.tasteScore} kind="taste" title={s.tasteReason ?? undefined} />
                ) : seasonFit[s.anilistId] != null ? (
                  <ScoreBadge
                    score={seasonFit[s.anilistId]}
                    suffix="%"
                    title="Ennyire illik az ízlésedhez (lokális becslés)"
                  />
                ) : undefined}
```

`src/app/page.tsx:466-470` — az `upcoming` szekció badge-e:
```tsx
                badge={<ScoreBadge score={s.tasteScore} kind="taste" title={s.tasteReason} />}
```

`src/app/page.tsx:511-519` — a `nextList` szekció badge-e:
```tsx
                    badge={nextFit[t.anilistId] != null ? (
                      <ScoreBadge
                        score={nextFit[t.anilistId]}
                        suffix="%"
                        title="Ennyire illik az ízlésedhez"
                      />
                    ) : undefined}
```

`src/app/bongeszo/page.tsx:5` — cseréld:
```tsx
import { useFitScores } from '@/lib/use-fit-scores'
import ScoreBadge from '@/components/ui/ScoreBadge'
```

`src/app/bongeszo/page.tsx:148-152` — a `badge={...}`:
```tsx
        badge={fit != null ? (
          <ScoreBadge score={fit} suffix="%" title="Ennyire illik az ízlésedhez" />
        ) : h.communityScore != null ? (
          <span className="surface-2 rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">
            {h.communityScore.toFixed(1)}
          </span>
        ) : undefined}
```

`src/app/vs/page.tsx:291-293` — a csoport-pontszám itt sima `<span>`, nem badge; csak a színt egységesítsd:
```tsx
                  <span
                    className="font-mono font-semibold shrink-0"
                    style={{ color: scoreColor(p.groupScore, 'fit') }}
                  >
```
és a fájl importjaihoz add: `import { scoreColor } from '@/lib/score-color'`.

- [ ] **Step 7: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
```

Expected: `tsc` 0 hiba. A teszt-szám a baseline **+7**. Ha `tsc` `fitColor`-ra panaszkodik valahol, azt a helyet is át kell írni — grep-eld: `npx tsc --noEmit` kimenete megmutatja.

- [ ] **Step 8: Commit**

```bash
git add src/lib/score-color.ts src/lib/score-color.test.ts src/components/ui/ScoreBadge.tsx src/lib/use-fit-scores.ts src/app/page.tsx src/app/bongeszo/page.tsx src/app/vs/page.tsx
git commit -m "feat(ui): egy szinskala minden pontszam-badge-hez (ScoreBadge)

scoreColor() + SCORE_THRESHOLDS lib fuggveny 7 teszttel; a negy egymastol
fuggetlenul masolt inline badge-jeloles helyere ScoreBadge primitiv.
A fitColor() torolve a use-fit-scores-bol.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `PageShell` + `SectionHeader` + `Button` + `Chip` → `/bongeszo`

A primitívek az első fogyasztójukkal együtt landolnak, hogy a task végén legyen mit megnézni.

**Files:**
- Create: `src/components/ui/PageShell.tsx`
- Create: `src/components/ui/SectionHeader.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Chip.tsx`
- Modify: `src/app/bongeszo/page.tsx` (fejléc, szűrő-sáv, lapozó, aktív-szűrő chipek, rács-sűrűség)

**Interfaces:**
- Consumes: Task 1 osztályai (`.surface-1|2|3`, `.display-l`, `.h2`, `.label-mono`), Task 2 `ScoreBadge`
- Produces:
  - `<PageShell width?={'narrow' | 'default' | 'wide'} className?={string}>` — `<main>`-et rendereli, benne a konténer
  - `<SectionHeader eyebrow?={string} title={string} action?={ReactNode} />`
  - `<Button variant?={'solid' | 'ghost' | 'outline'} size?={'sm' | 'md'} loading?={boolean} {...ButtonHTMLAttributes}>`
  - `<Chip variant?={'data' | 'genre' | 'link'} onDismiss?={() => void} href?={string} title?={string}>`

- [ ] **Step 1: `PageShell`**

Create `src/components/ui/PageShell.tsx`:

```tsx
import type { ReactNode } from 'react'

const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
} as const

type Props = {
  children: ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}

// Egy helyen dol el a lap-konteneres geometria. Korabban 17 oldal irta kulon,
// eltero ertekekkel (max-w-4xl/5xl, pt-24/pt-28).
export default function PageShell({ children, width = 'default', className = '' }: Props) {
  return (
    <main className="min-h-screen">
      <div
        className={`${WIDTHS[width]} mx-auto px-4 pt-24 pb-24 md:pb-16 ${className}`}
      >
        {children}
      </div>
    </main>
  )
}
```

A `pb-24 md:pb-16` a Task 6-ban jövő mobil alsó tab-bar helyét tartja fönn.

- [ ] **Step 2: `SectionHeader`**

Create `src/components/ui/SectionHeader.tsx`:

```tsx
import type { ReactNode } from 'react'

type Props = {
  /** apro mono cimke a cim FELETT — nem a cim helyett */
  eyebrow?: string
  title: string
  action?: ReactNode
}

export default function SectionHeader({ eyebrow, title, action }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-mono mb-1.5">{eyebrow}</p>}
        <h2 className="h2 text-text-1">{title}</h2>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 3: `Button`**

Create `src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

const VARIANTS = {
  solid: 'btn-solid',
  ghost: 'btn-ghost',
  outline: 'btn-ghost border border-white/12 hover:border-white/30',
} as const

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
} as const

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  loading?: boolean
  children: ReactNode
}

export default function Button({
  variant = 'outline',
  size = 'sm',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`${VARIANTS[variant]} ${SIZES[size]} whitespace-nowrap transition-colors disabled:opacity-40 ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  )
}
```

- [ ] **Step 4: `Chip`**

Create `src/components/ui/Chip.tsx`:

```tsx
import Link from 'next/link'
import type { ReactNode } from 'react'

const VARIANTS = {
  /** mono adat: ev, format, hossz, pontszam */
  data: 'surface-2 font-mono text-text-2',
  /** mufaj: csak korvonal */
  genre: 'hairline text-text-2',
  /** kattinthato / eldobhato aktiv szuro */
  link: 'hairline text-text-1 hover:border-white/35',
} as const

type Props = {
  children: ReactNode
  variant?: keyof typeof VARIANTS
  href?: string
  title?: string
  /** ha van, egy ✕ jelenik meg a chip vegen */
  onDismiss?: () => void
}

export default function Chip({ children, variant = 'data', href, title, onDismiss }: Props) {
  const cls = `${VARIANTS[variant]} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors`

  if (href) {
    return (
      <Link href={href} title={title} className={`${cls} hover:text-text-1`}>
        {children} <span aria-hidden>→</span>
      </Link>
    )
  }

  if (onDismiss) {
    return (
      <button onClick={onDismiss} title={title} className={cls}>
        {children} <span aria-hidden className="text-text-3">✕</span>
      </button>
    )
  }

  return <span title={title} className={cls}>{children}</span>
}
```

- [ ] **Step 5: `/bongeszo` átírása a primitívekre**

`src/app/bongeszo/page.tsx` — a következő cserék:

1. Importok kiegészítése:
```tsx
import PageShell from '@/components/ui/PageShell'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
```

2. `:187` — a `<main …>` sort cseréld `<PageShell className="flex flex-col gap-10">`-re, és a fájl végi `</main>`-t (`:323`) `</PageShell>`-re.

3. `:188-193` — a fejléc:
```tsx
      <div>
        <p className="label-mono mb-2">Böngésző</p>
        <h1 className="display-l text-text-1">Katalógus-keresés</h1>
      </div>
```

4. `:197` — a szűrő-sáv legyen sticky és `surface-3`:
```tsx
      <div
        data-tour="search"
        className="surface-3 sticky top-20 z-30 rounded-[--r-lg] p-4 flex flex-wrap items-center gap-2 text-sm"
      >
```

5. `:232-240` — a stúdió-szűrő gomb helyére `Chip`:
```tsx
        {studioFilter && (
          <Chip
            variant="link"
            title="Stúdió-szűrő törlése"
            onDismiss={() => { setStudioFilter(null); syncFilterUrl(null, seasonKey) }}
          >
            Stúdió: {studioFilter}
          </Chip>
        )}
        {(studioFilter || seasonKey) && (
          <Chip
            variant="link"
            title="Minden szűrő törlése"
            onDismiss={() => { setStudioFilter(null); setSeasonKey(null); syncFilterUrl(null, null) }}
          >
            Töröl mind
          </Chip>
        )}
```

6. A négy `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4` osztálylistát (`:265`, `:277`, `:285`, `:300`) cseréld mind a négy helyen erre (sűrűbb, 6 kolumna `2xl`-en):
```
grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8
```

7. A három szekció-címkét (`:248-253`, `:274-276`, `:284`) cseréld `SectionHeader`-re:
```tsx
            <SectionHeader
              eyebrow="Szűrve"
              title={[
                studioFilter ? `Stúdió: ${studioFilter}` : null,
                seasonKey === 'current' ? 'Aktuális szezon' : seasonKey === 'next' ? 'Következő szezon' : null,
              ].filter(Boolean).join(' · ')}
            />
```
```tsx
              <SectionHeader
                eyebrow="Felkapott most"
                title={trending ? `${SEASON_LABELS[trending.season.season] ?? trending.season.season} ${trending.season.year}` : 'Ebben a szezonban'}
              />
```
```tsx
              <SectionHeader eyebrow="Katalógus" title="Nálunk népszerű" />
```

8. `:304-320` — a lapozó `Button`-re, lapszám-kontextussal:
```tsx
          <div className="flex items-center justify-center gap-4 text-sm">
            <Button size="md" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0}>
              ← Előző
            </Button>
            <span className="font-mono text-xs text-text-2 tabular-nums">
              {page + 1}. oldal · {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + hits.length}
            </span>
            <Button size="md" onClick={() => setPage((p) => p + 1)} disabled={hits.length < PAGE_SIZE}>
              Következő →
            </Button>
          </div>
```

9. `:156-167` — a kártya-footer három add-gombja `Button`-re:
```tsx
          <span className="flex gap-1">
            {ADD_OPTIONS.map((o) => (
              <Button
                key={o.status}
                onClick={() => quickAdd(h, o.status)}
                title={`Hozzáadás: ${o.label}`}
                className="font-mono text-[10px] uppercase tracking-wide"
              >
                {o.label}
              </Button>
            ))}
          </span>
```

- [ ] **Step 6: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: `tsc` 0 hiba, teszt-szám baseline+7 (nem változott Task 2 óta), build zöld.

- [ ] **Step 7: Vizuális ellenőrzés**

`npm run dev`, majd Playwright MCP-vel `http://localhost:3000/bongeszo` 1440×900 **és** 390×844. Nézd meg mindkét képet. Amit ellenőrizz:
- a `Katalógus-keresés` cím most serif és nagy
- a szűrő-sáv scrollnál a nav alatt megáll (sticky), nem csúszik el
- 390px-en a szűrő-sáv nem lóg ki, a chipek tördelnek
- a rács `gap-y-8`-tól levegősebb, a kártyák nem tapadnak

- [ ] **Step 8: Commit**

```bash
git add src/components/ui src/app/bongeszo/page.tsx
git commit -m "feat(ui): PageShell/SectionHeader/Button/Chip primitivek + bongeszo atiras

Sticky surface-3 szuro-sav, aktiv szurok chipkent + 'Torol mind',
suruebb racs (6 kolumna 2xl-en, gap-y-8), display-l fejlec, lapozo
lapszam-kontextussal. A lapozas lapozas marad, vegtelen-scroll nincs.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `Skeleton` + `EmptyState` → `/bongeszo` betöltési és üres ágak

`/bongeszo`-n ma **három** helyen ugyanaz a villogó „Betöltés…" mono-szöveg és **négy** helyen csupasz `<p>` az üres állapotra.

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Modify: `src/app/bongeszo/page.tsx` (3 betöltési + 4 üres ág)

**Interfaces:**
- Consumes: Task 1 (`.surface-1`, `@keyframes shimmer`), Task 3 (`Button`)
- Produces:
  - `<Skeleton variant?={'poster' | 'text' | 'row'} count?={number} />`
  - `<EmptyState eyebrow?={string} title={string} text?={string} action?={ReactNode} />`

- [ ] **Step 1: `Skeleton`**

Create `src/components/ui/Skeleton.tsx`:

```tsx
const SHIMMER =
  'bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_25%,rgba(255,255,255,0.07)_37%,rgba(255,255,255,0.03)_63%)] bg-[length:400%_100%] animate-[shimmer_1.6s_linear_infinite]'

type Props = {
  variant?: 'poster' | 'text' | 'row'
  /** hany darab — poszternel a racs elemszama */
  count?: number
}

// Vazlat a betoltesre. Layout-ugras nelkul tartja a helyet.
export default function Skeleton({ variant = 'poster', count = 1 }: Props) {
  if (variant === 'poster') {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className={`aspect-[2/3] w-full rounded-[--r-md] ${SHIMMER}`} />
            <div className={`h-3.5 w-4/5 rounded ${SHIMMER}`} />
            <div className={`h-2.5 w-2/5 rounded ${SHIMMER}`} />
          </div>
        ))}
      </>
    )
  }

  if (variant === 'row') {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-8 h-11 shrink-0 rounded-[--r-sm] ${SHIMMER}`} />
            <div className={`h-3.5 flex-1 rounded ${SHIMMER}`} />
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`h-3.5 w-full rounded ${SHIMMER}`} />
      ))}
    </>
  )
}
```

- [ ] **Step 2: `EmptyState`**

Create `src/components/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  text?: string
  action?: ReactNode
}

export default function EmptyState({ eyebrow, title, text, action }: Props) {
  return (
    <div className="surface-1 rounded-[--r-lg] px-8 py-14 text-center flex flex-col items-center gap-3">
      {eyebrow && <p className="label-mono">{eyebrow}</p>}
      <p className="h2 text-text-1">{title}</p>
      {text && <p className="text-sm text-text-2 max-w-sm leading-relaxed">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 3: A 3 betöltési ág cseréje `/bongeszo`-n**

Importok: `import Skeleton from '@/components/ui/Skeleton'` és `import EmptyState from '@/components/ui/EmptyState'`. A `motion` importja **maradhat**, ha máshol használt; ha a `tsc` „unused"-ot jelez, töröld.

A `filtered == null` ág (a Task 3 utáni fájlban a `<motion.p …>Betöltés…</motion.p>`):
```tsx
            {filtered == null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
                <Skeleton variant="poster" count={12} />
              </div>
            ) : filtered.length === 0 ? (
```

A keresési `loading` ág:
```tsx
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
          <Skeleton variant="poster" count={12} />
        </div>
      ) : (
```

A harmadik: a `trending == null` eset ma a `Írj be egy címet a kereséshez.` ágba esik. Válaszd külön, hogy betöltés közben is váz legyen:
```tsx
        ) : trending == null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8">
            <Skeleton variant="poster" count={12} />
          </div>
        ) : (
```
(a `trendingHits && (…)` ág **után**, a végső `else` **elé**)

- [ ] **Step 4: A 4 üres ág cseréje `EmptyState`-re**

„Nincs találat ezzel a szűrővel." / „Még kevés bejelentett cím…":
```tsx
            ) : filtered.length === 0 ? (
              <EmptyState
                eyebrow="Szűrő"
                title={seasonKey === 'next' ? 'Még kevés bejelentett cím' : 'Nincs találat'}
                text={seasonKey === 'next'
                  ? 'A következő szezon kínálatát a katalógus-sync fokozatosan bővíti.'
                  : 'Próbáld más stúdióval vagy szezonnal.'}
                action={
                  <Button onClick={() => { setStudioFilter(null); setSeasonKey(null); syncFilterUrl(null, null) }}>
                    Szűrők törlése
                  </Button>
                }
              />
            ) : (
```

„Írj be egy címet a kereséshez.":
```tsx
        ) : (
          <EmptyState
            eyebrow="Katalógus"
            title="Mit keresel?"
            text="130 ezer anime és manga a saját adatbázisunkból. Írj be egy címet, vagy szűrj szezonra."
          />
        )
```

„Nincs találat a katalógusban.":
```tsx
          {hits.length === 0 && (
            <EmptyState
              eyebrow="Keresés"
              title="Nincs találat"
              text={`A „${search.trim()}" kifejezésre nincs cím a katalógusban. Próbáld a romaji címmel, vagy váltsd át ${type === 'ANIME' ? 'mangára' : 'animére'}.`}
              action={<Button onClick={() => setKind(type === 'ANIME' ? 'MANGA' : 'ANIME')}>
                Váltás {type === 'ANIME' ? 'mangára' : 'animére'}
              </Button>}
            />
          )}
```

Figyelj: ha `hits.length === 0`, a lapozó gombokat **ne** rendereld. Tedd a lapozó `<div>`-et `{hits.length > 0 && (…)}` mögé.

- [ ] **Step 5: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: 0 `tsc` hiba, teszt-szám változatlan, build zöld.

- [ ] **Step 6: Vizuális ellenőrzés — a betöltési állapot is**

`npm run dev`. Playwright MCP-vel `http://localhost:3000/bongeszo`, majd:
- `browser_take_screenshot` **rögtön** navigálás után (a trending-váz elkapásához)
- írj be a keresőbe egy kacatot (`browser_type` a keresőbe: `zzzzqqq`) → **nézd meg** az `EmptyState`-et
- töröld, majd írj be `naruto`-t → nézd meg a találati rácsot

Amit ellenőrizz: a váz ugyanannyi helyet foglal, mint a valódi rács (nincs layout-ugrás betöltés után), és a shimmer megy.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Skeleton.tsx src/components/ui/EmptyState.tsx src/app/bongeszo/page.tsx
git commit -m "feat(ui): Skeleton + EmptyState primitiv, bongeszo allapotai atirva

Harom villogo 'Betoltes...' mono-szoveg helyere poszter-vazak (layout-ugras
nelkul), negy csupasz <p> helyere EmptyState magyarazattal es kiutkeresso
gombbal. A lapozo nem jelenik meg nulla talalatnal.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `PosterAmbient` + `MediaCard` átírás

Ez a legnagyobb egyszeri vizuális hatás: a `MediaCard` mind a 4 oldal fő eleme.

**Files:**
- Create: `src/components/ui/PosterAmbient.tsx`
- Modify: `src/components/MediaCard.tsx` (teljes átírás, 53 sor)
- Modify: `src/app/page.tsx` (a leírás-prop használata a rácsokban)

**Interfaces:**
- Consumes: Task 1 (`.poster-ambient`, `.poster-glow`, `--r-md`), Task 2 (`ScoreBadge` a hívóknál)
- Produces:
  - `<PosterAmbient src={string | null} intensity?={'hero' | 'card' | 'row'} className?={string} />`
  - `MediaCard` új props: a meglévők + `variant?: 'poster' | 'row'`. **A meglévő prop-nevek és -típusok nem változnak** (`title`, `coverUrl`, `genres`, `description`, `href`, `badge`, `footer`, `streaming`), így a 3 hívó oldal nem törik el.

- [ ] **Step 1: `PosterAmbient`**

Create `src/components/ui/PosterAmbient.tsx`:

```tsx
type Props = {
  src: string | null
  intensity?: 'hero' | 'card' | 'row'
  className?: string
}

// A borito blur-kopiaja a tartalom alatt. Ez adja a cover-driven irany szinet
// adat nelkul: nincs kinyert hex, nincs DB-oszlop, nincs canvas-extrakcio.
export default function PosterAmbient({ src, intensity = 'hero', className = '' }: Props) {
  if (!src) return null
  return (
    <div className={`poster-ambient ${className}`} data-intensity={intensity} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  )
}
```

- [ ] **Step 2: `MediaCard` teljes átírása**

Írd felül `src/components/MediaCard.tsx`-et:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { stripHtml, clampText } from '@/lib/description'

type StreamLink = { site: string; url: string }

type Props = {
  title: string
  coverUrl: string | null
  genres: string[]
  description?: string | null
  href?: string
  badge?: ReactNode
  footer?: ReactNode
  streaming?: StreamLink[]
  variant?: 'poster' | 'row'
}

// Filmplakat-ritmus: a poszter MAGA a kartya, nincs uveg-keret korulotte.
// A leiras csak hoverre csuszik be — korabban mindig ott allt 3 sorban es
// telezsufolta a racsot.
export default function MediaCard({
  title, coverUrl, genres, description, href, badge, footer, streaming, variant = 'poster',
}: Props) {
  const desc = clampText(stripHtml(description ?? null))

  if (variant === 'row') {
    const inner = (
      <>
        <div className="relative w-8 h-11 shrink-0 overflow-hidden rounded-[--r-sm] bg-white/5">
          {coverUrl && <Image src={coverUrl} alt="" fill sizes="32px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-1 truncate">{title}</p>
          {genres.length > 0 && (
            <p className="font-mono text-[10px] text-text-3 truncate">{genres.slice(0, 2).join(' · ')}</p>
          )}
        </div>
        {badge}
      </>
    )
    return (
      <div className="group relative flex items-center gap-3 rounded-[--r-md] px-2 py-2 hover:bg-white/4 transition-colors">
        {href ? (
          <Link href={href} className="flex items-center gap-3 min-w-0 flex-1">{inner}</Link>
        ) : inner}
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    )
  }

  const cover = (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[--r-md] bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      {coverUrl && (
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes="220px"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      )}
      {/* labazat a badge olvashatosagahoz */}
      {badge && (
        <>
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
          <div className="absolute top-2 right-2">{badge}</div>
        </>
      )}
      {/* a leiras hoverre csuszik be a poszter aljara */}
      {desc && (
        <div className="absolute inset-x-0 bottom-0 p-3 pt-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out pointer-events-none">
          <p className="text-[11px] text-text-1/90 leading-snug line-clamp-4">{desc}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="group relative flex flex-col gap-2">
      {/* a poszter sajat szine izzik a kartya alatt hoverre */}
      {coverUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={coverUrl} alt="" aria-hidden className="poster-glow opacity-0 group-hover:opacity-60" />
      )}
      {href ? <Link href={href}>{cover}</Link> : cover}
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="text-[15px] font-medium text-text-1 line-clamp-2 leading-snug hover:underline decoration-white/25 underline-offset-4">
            {title}
          </Link>
        ) : (
          <span className="text-[15px] font-medium text-text-1 line-clamp-2 leading-snug">{title}</span>
        )}
        {genres.length > 0 && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-3 truncate">
            {genres.slice(0, 2).join(' · ')}
          </p>
        )}
        {streaming && streaming.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {streaming.map((s) => (
              <a
                key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.site}
                className="rounded-[--r-sm] bg-white/8 px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-2 hover:text-text-1"
              >
                {s.site.slice(0, 4)}
              </a>
            ))}
          </div>
        )}
      </div>
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  )
}
```

**Miért `<img>` és nem `next/image` a glow-nál:** a `poster-glow` dekoratív, `aria-hidden`, `z-index:-1` alatt van, és a `next/image` `fill` módja `position:absolute`-ot ír, ami ütközne a `.poster-glow` saját `inset`-jével. A borító már így is le van töltve a `next/image` által, tehát a böngésző cache-ből veszi.

- [ ] **Step 3: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: 0 hiba. A hívók nem törnek el, mert a prop-felület nem változott.

- [ ] **Step 4: Vizuális ellenőrzés — ez a task lényege**

`npm run dev`. Playwright MCP-vel:
- `http://localhost:3000/bongeszo` 1440×900 → `browser_hover` egy kártyára → `browser_take_screenshot`. **Nézd meg**: izzik-e a poszter színe a kártya alatt, becsúszik-e a leírás, nagyítódik-e finoman a borító.
- ugyanaz 390×844-en: a 2-kolumnás rácsban a hover nincs (touch), de a kártyáknak keret nélkül is olvashatónak kell lenniük.

Ha a glow nem látszik: ellenőrizd, hogy a `.poster-glow` szülője (`.group`) nem kapott hátteret, mert a `z-index:-1` a szülő háttere alá tenné.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PosterAmbient.tsx src/components/MediaCard.tsx
git commit -m "feat(ui): MediaCard filmplakat-ritmusra, PosterAmbient primitiv

Uveg-keret le a kartyarol (a poszter maga a kartya), poster-glow hoverre
a borito sajat szinebol, leiras csak hoverre csuszik be (korabban mindig
ott allt 3 sorban es telezsufolta a racsot), max 2 mufaj, row-variant a
sor-alaku listakhoz. A prop-felulet valtozatlan: a hivok nem tornek el.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `nav.ts` (TDD) + TopNav átírás + mobil tab-bar

**Files:**
- Create: `src/lib/nav.ts`
- Create: `src/lib/nav.test.ts`
- Create: `src/components/MobileTabBar.tsx`
- Modify: `src/components/TopNav.tsx` (teljes átírás, 87 sor)
- Modify: `src/app/layout.tsx` (a `MobileTabBar` beszúrása)
- Modify: `messages/hu.json`, `messages/en.json` (`nav.wrapped`, `nav.more`, `nav.search`)
- Modify: `src/app/bongeszo/page.tsx` (a `?focus=1` kezelése)

**Interfaces:**
- Consumes: Task 1 (`.surface-3`), Task 3 (`Button` nem kell itt)
- Produces:
  - `type NavTab = { href: string; key: string; pendingBadge?: boolean }`
  - `PRIMARY_TABS: NavTab[]` (5 elem), `MORE_TABS: NavTab[]` (5 elem), `MOBILE_TABS: NavTab[]` (4 elem)
  - `isTabActive(href: string, pathname: string): boolean`
  - `isNavHidden(pathname: string): boolean`
  - `isMoreActive(pathname: string): boolean`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  PRIMARY_TABS, MORE_TABS, MOBILE_TABS,
  isTabActive, isNavHidden, isMoreActive,
} from './nav'

describe('nav szerkezet', () => {
  it('5 elsodleges es 5 tovabbi tab', () => {
    expect(PRIMARY_TABS).toHaveLength(5)
    expect(MORE_TABS).toHaveLength(5)
  })

  it('egy href nem szerepel ket helyen', () => {
    const all = [...PRIMARY_TABS, ...MORE_TABS].map((t) => t.href)
    expect(new Set(all).size).toBe(all.length)
  })

  it('a mobil sav 4 napi-hasznalatu tabot ad', () => {
    expect(MOBILE_TABS.map((t) => t.href)).toEqual(['/', '/lista', '/bongeszo', '/velemenyek'])
  })

  it('a mobil tabok az elsodlegesek kozul valok (ugyanaz az objektum)', () => {
    for (const t of MOBILE_TABS) expect(PRIMARY_TABS).toContain(t)
  })

  it('a velemenyek tab viszi a pending-badge-et', () => {
    const op = PRIMARY_TABS.find((t) => t.href === '/velemenyek')
    expect(op?.pendingBadge).toBe(true)
  })
})

describe('isTabActive', () => {
  it('a gyoker csak pontos egyezesre aktiv', () => {
    expect(isTabActive('/', '/')).toBe(true)
    expect(isTabActive('/', '/lista')).toBe(false)
  })

  it('alutvonalon is aktiv', () => {
    expect(isTabActive('/lista', '/lista')).toBe(true)
    expect(isTabActive('/lista', '/lista/5')).toBe(true)
  })

  it('NEM aktiv a csak prefixben egyezo utvonalon', () => {
    // a regi startsWith() ezt tevesen aktivnak jelolte
    expect(isTabActive('/lista', '/listazas')).toBe(false)
    expect(isTabActive('/vs', '/vsomething')).toBe(false)
  })
})

describe('isNavHidden', () => {
  it('login es publikus megoszto oldalon rejtett', () => {
    expect(isNavHidden('/login')).toBe(true)
    expect(isNavHidden('/p/abc123')).toBe(true)
  })

  it('mashol latszik', () => {
    expect(isNavHidden('/')).toBe(false)
    expect(isNavHidden('/lista')).toBe(false)
    expect(isNavHidden('/profil')).toBe(false)
  })
})

describe('isMoreActive', () => {
  it('igaz, ha a Tovabb menu barmelyik tabjan allunk', () => {
    expect(isMoreActive('/vibe')).toBe(true)
    expect(isMoreActive('/stats')).toBe(true)
    expect(isMoreActive('/wrapped')).toBe(true)
  })

  it('hamis az elsodleges tabokon', () => {
    expect(isMoreActive('/')).toBe(false)
    expect(isMoreActive('/lista')).toBe(false)
  })
})
```

- [ ] **Step 2: Futtasd — buknia kell**

```bash
npx vitest run src/lib/nav.test.ts
```

Expected: FAIL — `Failed to resolve import "./nav"`.

- [ ] **Step 3: Minimális implementáció**

Create `src/lib/nav.ts`:

```ts
export type NavTab = {
  href: string
  /** a messages/*.json `nav` névtér kulcsa */
  key: string
  pendingBadge?: boolean
}

export const PRIMARY_TABS: NavTab[] = [
  { href: '/', key: 'news' },
  { href: '/graf', key: 'graph' },
  { href: '/lista', key: 'list' },
  { href: '/bongeszo', key: 'browse' },
  { href: '/velemenyek', key: 'opinions', pendingBadge: true },
]

export const MORE_TABS: NavTab[] = [
  { href: '/toplista', key: 'leaderboard' },
  { href: '/vibe', key: 'vibe' },
  { href: '/stats', key: 'stats' },
  { href: '/vs', key: 'vs' },
  { href: '/wrapped', key: 'wrapped' },
]

// Mobilon a napi-hasznalatu negy. A 3D-graf tudatosan kimarad: egy
// force-graph 390px-en nem napi muvelet, a 'Tovabb' menubol elerheto.
const MOBILE_HREFS = ['/', '/lista', '/bongeszo', '/velemenyek'] as const

export const MOBILE_TABS: NavTab[] = MOBILE_HREFS.map((href) => {
  const tab = PRIMARY_TABS.find((t) => t.href === href)
  if (!tab) throw new Error(`MOBILE_TABS: nincs ilyen elsodleges tab: ${href}`)
  return tab
})

// Pontos egyezes vagy valodi alutvonal. A korabbi startsWith() a
// '/listazas'-t is a '/lista' tabnak jelolte.
export function isTabActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isNavHidden(pathname: string): boolean {
  return pathname === '/login' || pathname === '/p' || pathname.startsWith('/p/')
}

export function isMoreActive(pathname: string): boolean {
  return MORE_TABS.some((t) => isTabActive(t.href, pathname))
}
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

```bash
npx vitest run src/lib/nav.test.ts
```

Expected: PASS, 12 teszt (5 szerkezet + 3 `isTabActive` + 2 `isNavHidden` + 2 `isMoreActive`).

- [ ] **Step 5: i18n kulcsok**

`messages/hu.json` — a `nav` névtérbe:
```json
    "wrapped": "Wrapped",
    "more": "Több",
    "search": "Keresés"
```

`messages/en.json` — a `nav` névtérbe:
```json
    "wrapped": "Wrapped",
    "more": "More",
    "search": "Search"
```

Ellenőrzés, hogy mindkét fájl érvényes JSON és ugyanazok a kulcsok:
```bash
node -e "const h=require('./messages/hu.json'),e=require('./messages/en.json');const a=Object.keys(h.nav).sort(),b=Object.keys(e.nav).sort();if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('nav kulcsok elternek: '+a+' vs '+b);console.log('nav kulcsok OK:',a.join(','))"
```
Expected: `nav kulcsok OK: browse,graph,leaderboard,list,more,news,opinions,search,settings,stats,vibe,vs,wrapped`

- [ ] **Step 6: `TopNav` átírása**

Írd felül `src/components/TopNav.tsx`-et:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import LocaleSwitcher from './LocaleSwitcher'
import { PRIMARY_TABS, MORE_TABS, isTabActive, isNavHidden, isMoreActive } from '@/lib/nav'

export default function TopNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const hidden = isNavHidden(pathname)

  // velemeny-varo darabszam a badge-hez; oldalvaltasnal frissul
  useEffect(() => {
    if (hidden) return
    fetch('/api/opinions/pending?countOnly=1')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((j: { count: number }) => setPendingCount(j.count ?? 0))
      .catch(() => { /* badge nelkul is el a nav */ })
  }, [pathname, hidden])

  // a nav lefele scrollnal surubb lesz
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // a Tovabb menu bezarasa kulso kattintasra / Escape-re
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // oldalvaltasnal csukodjon
  useEffect(() => { setMoreOpen(false) }, [pathname])

  if (hidden) return null

  const tabClass = (active: boolean) =>
    `relative px-3 py-1.5 rounded-full text-sm transition-colors ${
      active ? 'bg-white/10 text-text-1' : 'text-text-2 hover:text-text-1 hover:bg-white/5'
    }`

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 rounded-full pl-4 pr-2 py-1.5 hidden md:flex items-center gap-2 max-w-[95vw] transition-[background,box-shadow] duration-300 ${
        scrolled ? 'surface-3' : 'surface-2'
      }`}
    >
      <Link href="/" className="flex items-center gap-2 mr-1 shrink-0" aria-label="Anime Graph">
        {/* graf-mark: harom pont, ket el — az azonossag a 3D-terkepbol jon */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M4.5 12.5 9 5.5l4.5 7" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45" />
          <circle cx="9" cy="5" r="2.1" fill="currentColor" />
          <circle cx="4" cy="13" r="1.6" fill="currentColor" fillOpacity="0.75" />
          <circle cx="14" cy="13" r="1.6" fill="currentColor" fillOpacity="0.75" />
        </svg>
        <span className="display-l !text-[17px] leading-none text-text-1">Anime Graph</span>
        <span className="label-mono hidden lg:inline">アニメ</span>
      </Link>

      <div className="h-4 w-px bg-white/10 shrink-0" />

      <ul className="flex items-center gap-0.5">
        {PRIMARY_TABS.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className={tabClass(isTabActive(tab.href, pathname))}>
              {t(tab.key)}
              {tab.pendingBadge && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white/15 px-1.5 min-w-[18px] h-[18px] text-[10px] font-mono text-text-1 align-middle">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          </li>
        ))}
        <li ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={tabClass(isMoreActive(pathname) || moreOpen)}
          >
            {t('more')} <span aria-hidden className="text-[10px] align-middle">▾</span>
          </button>
          {moreOpen && (
            <ul
              role="menu"
              className="surface-3 absolute right-0 top-[calc(100%+0.5rem)] min-w-40 rounded-[--r-md] p-1.5 flex flex-col gap-0.5"
            >
              {MORE_TABS.map((tab) => (
                <li key={tab.href} role="none">
                  <Link
                    role="menuitem"
                    href={tab.href}
                    className={`block rounded-[--r-sm] px-3 py-2 text-sm transition-colors ${
                      isTabActive(tab.href, pathname)
                        ? 'bg-white/10 text-text-1'
                        : 'text-text-2 hover:text-text-1 hover:bg-white/5'
                    }`}
                  >
                    {t(tab.key)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>

      <div className="h-4 w-px bg-white/10 shrink-0" />

      <Link href="/bongeszo?focus=1" aria-label={t('search')} title={t('search')} className="btn-ghost p-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </Link>
      <LocaleSwitcher compact />
      <Link
        href="/beallitasok"
        aria-label={t('settings')}
        className={`btn-ghost p-2 ${isTabActive('/beallitasok', pathname) ? 'bg-white/10 text-text-1' : ''}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    </nav>
  )
}
```

- [ ] **Step 7: `MobileTabBar`**

Create `src/components/MobileTabBar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MOBILE_TABS, MORE_TABS, isTabActive, isNavHidden, isMoreActive } from '@/lib/nav'

// Alsó tab-sáv <md alatt. Korabban a felso pillt vizszintesen kellett huzni
// mobilon; ez volt a legnagyobb mobil-hianyossag.
export default function MobileTabBar() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const hidden = isNavHidden(pathname)

  useEffect(() => { setOpen(false) }, [pathname])

  if (hidden) return null

  return (
    <>
      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <ul
            className="surface-3 absolute right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] min-w-44 rounded-[--r-md] p-1.5 flex flex-col gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {MORE_TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={`block rounded-[--r-sm] px-3 py-2.5 text-sm ${
                    isTabActive(tab.href, pathname) ? 'bg-white/10 text-text-1' : 'text-text-2'
                  }`}
                >
                  {t(tab.key)}
                </Link>
              </li>
            ))}
            {/* a graf mobilon innen erheto el */}
            <li>
              <Link
                href="/graf"
                className={`block rounded-[--r-sm] px-3 py-2.5 text-sm ${
                  isTabActive('/graf', pathname) ? 'bg-white/10 text-text-1' : 'text-text-2'
                }`}
              >
                {t('graph')}
              </Link>
            </li>
            <li>
              <Link
                href="/beallitasok"
                className={`block rounded-[--r-sm] px-3 py-2.5 text-sm ${
                  isTabActive('/beallitasok', pathname) ? 'bg-white/10 text-text-1' : 'text-text-2'
                }`}
              >
                {t('settings')}
              </Link>
            </li>
          </ul>
        </div>
      )}

      <nav
        className="surface-3 md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around rounded-t-[--r-lg] px-1 pt-1.5"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
      >
        {MOBILE_TABS.map((tab) => {
          const active = isTabActive(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-[--r-sm] px-1 py-2 text-center text-[11px] transition-colors ${
                active ? 'text-text-1' : 'text-text-3'
              }`}
            >
              <span className={`block truncate ${active ? 'font-medium' : ''}`}>{t(tab.key)}</span>
              <span
                className={`mx-auto mt-1 block h-0.5 w-5 rounded-full transition-opacity ${
                  active ? 'bg-white/70 opacity-100' : 'opacity-0'
                }`}
              />
            </Link>
          )
        })}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex-1 rounded-[--r-sm] px-1 py-2 text-center text-[11px] transition-colors ${
            isMoreActive(pathname) || open ? 'text-text-1' : 'text-text-3'
          }`}
        >
          <span className="block truncate">{t('more')}</span>
          <span
            className={`mx-auto mt-1 block h-0.5 w-5 rounded-full transition-opacity ${
              isMoreActive(pathname) ? 'bg-white/70 opacity-100' : 'opacity-0'
            }`}
          />
        </button>
      </nav>
    </>
  )
}
```

- [ ] **Step 8: `layout.tsx` — `MobileTabBar` beszúrása**

`src/app/layout.tsx` — import és render:
```tsx
import MobileTabBar from "@/components/MobileTabBar";
```
```tsx
        <IntlProvider>
          <TopNav />
          {children}
          <MobileTabBar />
        </IntlProvider>
```

- [ ] **Step 9: `?focus=1` kezelése `/bongeszo`-n**

`src/app/bongeszo/page.tsx` — a kereső-inputhoz ref, és a query-param olvasása. A meglévő querystring-olvasó `useEffect`-be (`:83-89`) tedd bele:

```tsx
  const searchRef = useRef<HTMLInputElement>(null)
```
(és a `useRef`-et vedd fel a `react` importba)

```tsx
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const st = sp.get('studio')
    if (st) setStudioFilter(st)
    const se = sp.get('season')
    if (se === 'current' || se === 'next') setSeasonKey(se)
    // a nav kereso-ikonja ide navigal: fokuszaljuk a meglevo inputot
    if (sp.get('focus') === '1') {
      searchRef.current?.focus()
      window.history.replaceState(null, '', '/bongeszo')
    }
  }, [])
```

És az inputra: `ref={searchRef}`.

- [ ] **Step 10: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: 0 `tsc` hiba, teszt-szám baseline+7+12 = **baseline+19**, build zöld.

- [ ] **Step 11: Vizuális ellenőrzés — desktop és mobil egyaránt**

`npm run dev`. Playwright MCP:
- 1440×900, `/`: a nav most 5 tab + `Több ▾`. Kattints a `Több`-re (`browser_click`) → screenshot: nyílik-e a menü, jó helyen van-e. Nyomj `Escape`-et (`browser_press_key`) → csukódik-e.
- Scrollozz le (`browser_evaluate` `window.scrollTo(0, 400)`) → screenshot: sűrűbb lett-e a nav.
- Kattints a kereső-ikonra → `/bongeszo`-ra visz, az input fókuszban van, és az URL-ből eltűnt a `?focus=1`.
- 390×844, `/`: a felső pill **nincs**, alul ott a tab-sáv 5 elemmel. Kattints a `Több`-re → felugró menü. Screenshot mindkettőről.
- Ellenőrizd, hogy a tartalom alja nem kerül a tab-sáv alá (a `PageShell` `pb-24`-je miatt nem szabad).

- [ ] **Step 12: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts src/components/TopNav.tsx src/components/MobileTabBar.tsx src/app/layout.tsx src/app/bongeszo/page.tsx messages/hu.json messages/en.json
git commit -m "feat(ui): nav ujraszervezes — 5 elsodleges + Tovabb menu + mobil tab-sav

nav.ts 13 teszttel: PRIMARY/MORE/MOBILE_TABS es isTabActive, ami mar nem
jeloli aktivnak a '/listazas'-t a '/lista' tabnal (startsWith-bug).
Kilenc tab egy huzhato pillben -> 5 tab + Tovabb menu; mobilon a felso pill
helyett also tab-sav safe-area paddinggel. Graf-mark + serif wordmark,
kereso-ikon (/bongeszo?focus=1), scroll-erzekeny nav-suruseg.
Uj nav-kulcsok: wrapped, more, search (hu+en).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `home-hero.ts` (TDD) + home szétvágás + hero

A 530 soros `page.tsx` 7 fetch-csel nem szerkeszthető megbízhatóan. A szétvágás előfeltétel, nem kozmetika.

**Files:**
- Create: `src/lib/home-hero.ts`
- Create: `src/lib/home-hero.test.ts`
- Create: `src/lib/motion.ts`
- Create: `src/components/home/HeroToday.tsx`
- Create: `src/components/home/FollowedRow.tsx`
- Create: `src/components/home/WeekCalendar.tsx`
- Create: `src/components/home/SeasonGrid.tsx`
- Create: `src/components/home/NextSeason.tsx`
- Create: `src/components/home/SocialFeed.tsx`
- Create: `src/components/home/types.ts`
- Modify: `src/app/page.tsx` (530 sor → komponáló ~90 sor)

**Interfaces:**
- Consumes: Task 1 osztályok, Task 2 `ScoreBadge`, Task 3 `PageShell`/`SectionHeader`/`Button`, Task 4 `Skeleton`/`EmptyState`, Task 5 `MediaCard`/`PosterAmbient`
- Produces:
  - `pickHero(mine, season, nowSec, fit?): HeroPick`
  - `type HeroPick` — négy variáns: `{kind:'airing'|'watching', item: HeroMine, …}`, `{kind:'discover', item: HeroSeason, score}`, `{kind:'empty'}`
  - `type HeroMine`, `type HeroSeason` — strukturális részhalmazok, amelyeket a `page.tsx` bővebb típusai kielégítenek
  - `src/components/home/types.ts`: `MineItem`, `SeasonItem`, `NextSeasonRow`, `WatchItem`, `UpcomingItem`, `NewsData` — a `page.tsx`-ből ide áthelyezve, hogy minden home-komponens innen importálja
  - `src/lib/motion.ts`: `EASE_OUT`, `REVEAL_TRANSITION`, `reveal(index?, maxDelay?)`, `riseIn`, `posterHover` — a spec §3 három nevesített presetje egy helyen

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/home-hero.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pickHero, type HeroMine, type HeroSeason } from './home-hero'

const NOW = 1_800_000_000

function mine(over: Partial<HeroMine> = {}): HeroMine {
  return {
    animeId: 1, anilistId: 101, title: 'A', coverUrl: null,
    status: 'watching', progress: 3, episodes: 12,
    airingAt: NOW + 3600, nextEpisode: 4,
    ...over,
  }
}

function season(over: Partial<HeroSeason> = {}): HeroSeason {
  return { anilistId: 201, title: 'S', coverUrl: null, tasteScore: null, ...over }
}

describe('pickHero', () => {
  it('1. az adasba kerulo cim nyer', () => {
    const p = pickHero([mine()], [season({ tasteScore: 99 })], NOW)
    expect(p.kind).toBe('airing')
    if (p.kind === 'airing') expect(p.item.animeId).toBe(1)
  })

  it('1. a legkorabbi JOVOBELI adas nyer', () => {
    const p = pickHero(
      [
        mine({ animeId: 1, airingAt: NOW + 7200 }),
        mine({ animeId: 2, airingAt: NOW + 600 }),
        mine({ animeId: 3, airingAt: NOW + 3600 }),
      ],
      [], NOW,
    )
    expect(p.kind).toBe('airing')
    if (p.kind === 'airing') expect(p.item.animeId).toBe(2)
  })

  it('1. a mar lement adas nem szamit', () => {
    const p = pickHero([mine({ animeId: 1, airingAt: NOW - 10, status: 'completed' })], [], NOW)
    expect(p.kind).not.toBe('airing')
  })

  it('2. jovobeli adas nelkul a legelorehaladottabb nezett cim', () => {
    const p = pickHero(
      [
        mine({ animeId: 1, airingAt: NOW - 10, progress: 2 }),
        mine({ animeId: 2, airingAt: NOW - 10, progress: 9 }),
      ],
      [], NOW,
    )
    expect(p.kind).toBe('watching')
    if (p.kind === 'watching') expect(p.item.animeId).toBe(2)
  })

  it('2. egyenlo progressnel a kisebb animeId (determinisztikus)', () => {
    const p = pickHero(
      [
        mine({ animeId: 7, airingAt: NOW - 10, progress: 5 }),
        mine({ animeId: 3, airingAt: NOW - 10, progress: 5 }),
      ],
      [], NOW,
    )
    expect(p.kind).toBe('watching')
    if (p.kind === 'watching') expect(p.item.animeId).toBe(3)
  })

  it('2. csak a watching statuszut valasztja', () => {
    const p = pickHero(
      [mine({ animeId: 1, airingAt: NOW - 10, status: 'completed', progress: 12 })],
      [season({ anilistId: 55, tasteScore: 60 })], NOW,
    )
    expect(p.kind).toBe('discover')
  })

  it('3. ures lista: a legjobb taste-pontszamu szezon-cim', () => {
    const p = pickHero(
      [],
      [
        season({ anilistId: 1, tasteScore: 40 }),
        season({ anilistId: 2, tasteScore: 88 }),
        season({ anilistId: 3, tasteScore: null }),
      ],
      NOW,
    )
    expect(p.kind).toBe('discover')
    if (p.kind === 'discover') {
      expect(p.item.anilistId).toBe(2)
      expect(p.score).toBe(88)
    }
  })

  it('3. taste-pontszam nelkul a lokalis fit-map dont', () => {
    const p = pickHero(
      [],
      [season({ anilistId: 1 }), season({ anilistId: 2 })],
      NOW,
      { 1: 30, 2: 77 },
    )
    expect(p.kind).toBe('discover')
    if (p.kind === 'discover') {
      expect(p.item.anilistId).toBe(2)
      expect(p.score).toBe(77)
    }
  })

  it('3. a taste-pontszam eronyerte a fit-becslessel szemben', () => {
    const p = pickHero(
      [],
      [season({ anilistId: 1, tasteScore: 51 }), season({ anilistId: 2 })],
      NOW,
      { 2: 95 },
    )
    if (p.kind === 'discover') expect(p.item.anilistId).toBe(1)
  })

  it('3. pontszam nelkul az elso szezon-cim, score null', () => {
    const p = pickHero([], [season({ anilistId: 9 })], NOW)
    expect(p.kind).toBe('discover')
    if (p.kind === 'discover') {
      expect(p.item.anilistId).toBe(9)
      expect(p.score).toBeNull()
    }
  })

  it('4. minden ures -> empty', () => {
    expect(pickHero([], [], NOW).kind).toBe('empty')
  })
})
```

- [ ] **Step 2: Futtasd — buknia kell**

```bash
npx vitest run src/lib/home-hero.test.ts
```

Expected: FAIL — `Failed to resolve import "./home-hero"`.

- [ ] **Step 3: Minimális implementáció**

Create `src/lib/home-hero.ts`:

```ts
// A cimlap hero-jaba kerulo cim kivalasztasa. Tiszta fuggveny, hogy a
// fallback-lanc tesztelheto legyen — a projektben csak node-kornyezetu
// lib-teszt fut, komponens-teszt nincs.

/** strukturalis reszhalmaz: a page.tsx MineItem tipusa kielegiti */
export type HeroMine = {
  animeId: number
  anilistId: number
  title: string
  coverUrl: string | null
  status: string
  progress: number
  episodes: number | null
  airingAt: number
  nextEpisode: number
}

/** strukturalis reszhalmaz: a page.tsx SeasonItem tipusa kielegiti */
export type HeroSeason = {
  anilistId: number
  title: string
  coverUrl: string | null
  tasteScore: number | null
}

export type HeroPick =
  | { kind: 'airing'; item: HeroMine }
  | { kind: 'watching'; item: HeroMine }
  | { kind: 'discover'; item: HeroSeason; score: number | null }
  | { kind: 'empty' }

export function pickHero(
  mine: HeroMine[],
  season: HeroSeason[],
  nowSec: number,
  fit: Record<number, number> = {},
): HeroPick {
  // 1. a legkozelebb adasba kerulo kovetett cim
  const upcoming = mine
    .filter((m) => m.airingAt > nowSec)
    .sort((a, b) => a.airingAt - b.airingAt || a.animeId - b.animeId)
  if (upcoming.length > 0) return { kind: 'airing', item: upcoming[0] }

  // 2. nincs jovobeli adas: a legelorehaladottabb nezett cim
  const watching = mine
    .filter((m) => m.status === 'watching')
    .sort((a, b) => b.progress - a.progress || a.animeId - b.animeId)
  if (watching.length > 0) return { kind: 'watching', item: watching[0] }

  // 3. felderites: a legjobb pontszamu szezon-cim. A taste-pontszam eronyerte
  //    a lokalis fit-becslessel szemben, mert az AI tobbet tud.
  if (season.length > 0) {
    const scoreOf = (s: HeroSeason): number | null => s.tasteScore ?? fit[s.anilistId] ?? null
    let best = season[0]
    let bestScore = scoreOf(season[0])
    for (const s of season.slice(1)) {
      const sc = scoreOf(s)
      if (sc != null && (bestScore == null || sc > bestScore)) {
        best = s
        bestScore = sc
      }
    }
    return { kind: 'discover', item: best, score: bestScore }
  }

  // 4. nincs mit mutatni
  return { kind: 'empty' }
}
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

```bash
npx vitest run src/lib/home-hero.test.ts
```

Expected: PASS, 11 teszt.

- [ ] **Step 5: Közös modulok — `motion.ts` és a home-típusok**

Create `src/lib/motion.ts` — a spec három nevesített presetje, hogy a viewport-reveal ne legyen két helyen inline duplikálva:

```ts
import type { Transition, Variants } from 'framer-motion'

// A token-reteg --ease-out-janak JS-megfeleloje (globals.css).
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const REVEAL_TRANSITION: Transition = { duration: 0.45, ease: EASE_OUT }

/** viewport-triggerelt belepes racs-elemeknek; a stagger az indexbol jon */
export function reveal(index = 0, maxDelay = 0.3) {
  return {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' } as const,
    transition: { ...REVEAL_TRANSITION, delay: Math.min(index * 0.03, maxDelay) },
  }
}

/** egyszeri belepes szekciora / panelre, index nelkul */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: REVEAL_TRANSITION },
}

/** poszter-hover: a MediaCard borito-nagyitasanak CSS-parja JS-oldalon */
export const posterHover: Transition = { duration: 0.5, ease: EASE_OUT }
```

Create `src/components/home/types.ts` — vágd ki a `src/app/page.tsx:25-79` típusait ide, változtatás nélkül, `export`-tal:

```ts
import type { FeedItem } from '@/lib/feed'

export type MineItem = {
  animeId: number
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  description: string | null
  status: string
  progress: number
  episodes: number | null
  airingAt: number
  nextEpisode: number
}

export type SeasonItem = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  episodes: number | null
  format: string | null
  description: string | null
  airingAt: number | null
  nextEpisode: number | null
  owned: boolean
  tasteScore: number | null
  tasteReason: string | null
  streaming?: { site: string; url: string }[]
}

export type NewsData = {
  season: { season: string; year: number }
  mine: MineItem[]
  seasonItems: SeasonItem[]
}

// a teljes next-season rács sorai a lokális katalógusból (/api/browse?season=next)
export type NextSeasonRow = {
  id: number
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  slug: string
  mediaType: string
  format: string | null
}

export type WatchItem = {
  id: number
  anilistId: number
  mediaType: string
  title: string
  coverUrl: string | null
  addedBy: number
  watchedEpisodes: number
}

export type UpcomingItem = SeasonItem & { tasteScore: number; tasteReason: string }

export type { FeedItem }
```

- [ ] **Step 6: `HeroToday`**

Create `src/components/home/HeroToday.tsx`:

```tsx
'use client'
import Link from 'next/link'
import Image from 'next/image'
import Countdown from '@/components/Countdown'
import PosterAmbient from '@/components/ui/PosterAmbient'
import ScoreBadge from '@/components/ui/ScoreBadge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { pickHero } from '@/lib/home-hero'
import { STATUS_LABELS } from '@/lib/status'
import type { MineItem, SeasonItem } from './types'

type Props = {
  /** null = meg tolt; ilyenkor vazlat all a helyen, nincs layout-ugras */
  mine: MineItem[] | null
  season: SeasonItem[]
  fit: Record<number, number>
  digest: string | null
  onBump: (m: MineItem) => void
  onPlan: (anilistId: number) => void
  planned: Set<number>
}

export default function HeroToday({ mine, season, fit, digest, onBump, onPlan, planned }: Props) {
  if (mine == null) {
    return (
      <section className="relative overflow-hidden rounded-[--r-xl] surface-1 px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-col gap-4 max-w-xl">
          <Skeleton variant="text" count={1} />
          <div className="h-12 w-3/4 rounded bg-white/5" />
          <Skeleton variant="text" count={2} />
        </div>
      </section>
    )
  }

  const pick = pickHero(mine, season, Math.floor(Date.now() / 1000), fit)
  if (pick.kind === 'empty') return null

  // az 'empty' agat mar visszaadtuk, a maradek harom varianson van .item
  const cover = pick.item.coverUrl
  const title = pick.item.title

  const eyebrow =
    pick.kind === 'airing' ? 'Ma' : pick.kind === 'watching' ? 'Ott folytatod' : 'Neked ajánljuk'

  const href =
    pick.kind === 'discover'
      ? `/anime/preview/${pick.item.anilistId}`
      : `/anime/${pick.item.animeId}`

  return (
    <section className="relative overflow-hidden rounded-[--r-xl] hairline">
      <PosterAmbient src={cover} intensity="hero" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/92 via-[#09090b]/70 to-transparent pointer-events-none" />

      <div className="relative flex items-center gap-6 px-6 py-10 sm:px-10 sm:py-14">
        {cover && (
          <Link href={href} className="hidden sm:block shrink-0">
            <div className="relative w-32 lg:w-40 aspect-[2/3] overflow-hidden rounded-[--r-md] shadow-2xl shadow-black/60">
              <Image src={cover} alt={title} fill sizes="160px" className="object-cover" />
            </div>
          </Link>
        )}

        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <p className="label-mono">{eyebrow}</p>
          <Link href={href}>
            <h1 className="display-xl text-text-1 line-clamp-2 hover:underline decoration-white/20 underline-offset-[10px]">
              {title}
            </h1>
          </Link>

          <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-text-2">
            {pick.kind === 'airing' && (
              <span className="text-text-1">
                EP {pick.item.nextEpisode} · <Countdown airingAt={pick.item.airingAt} />
              </span>
            )}
            {pick.kind === 'watching' && (
              <span className="text-text-1">
                {STATUS_LABELS[pick.item.status] ?? pick.item.status} ·{' '}
                {pick.item.progress}{pick.item.episodes ? `/${pick.item.episodes}` : ''}
              </span>
            )}
            {pick.kind === 'discover' && pick.score != null && (
              <ScoreBadge score={pick.score} kind="taste" title="Ennyire illik az ízlésedhez" />
            )}

            {pick.kind !== 'discover' ? (
              <Button size="md" onClick={() => onBump(pick.item)} title="Megnéztem egy részt">
                +1 rész
              </Button>
            ) : (
              <Button
                size="md"
                onClick={() => onPlan(pick.item.anilistId)}
                disabled={planned.has(pick.item.anilistId)}
              >
                {planned.has(pick.item.anilistId) ? '✓ Terveim között' : '+ Tervezem'}
              </Button>
            )}
          </div>

          {digest && (
            <p className="text-sm text-text-2 leading-relaxed max-w-[58ch] border-l border-white/12 pl-4 mt-1">
              <span className="label-mono mr-2">✦ ma</span>
              {digest}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: `FollowedRow`**

Create `src/components/home/FollowedRow.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import MediaCard from '@/components/MediaCard'
import Countdown from '@/components/Countdown'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import { reveal } from '@/lib/motion'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { MineItem } from './types'

type Props = {
  mine: MineItem[]
  /** a hero-ban mar szereplo cim nem ismetlodik itt */
  excludeAnimeId?: number
  onBump: (m: MineItem) => void
}

export default function FollowedRow({ mine, excludeAnimeId, onBump }: Props) {
  const items = mine.filter((m) => m.animeId !== excludeAnimeId)
  if (items.length === 0) return null

  return (
    <section>
      <SectionHeader eyebrow="Amit követsz" title="Következő rész" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
        {items.map((m, i) => (
          <motion.div key={m.animeId} {...reveal(i, 0.24)} className="h-full">
            <MediaCard
              title={m.title}
              coverUrl={m.coverUrl}
              genres={m.genres}
              description={m.description}
              href={`/anime/${m.animeId}`}
              badge={
                <span className="surface-2 rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">
                  EP {m.nextEpisode} · <Countdown airingAt={m.airingAt} />
                </span>
              }
              footer={
                <div className="flex items-center justify-between gap-2">
                  <p className="label-mono flex items-center gap-1.5">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${m.status === 'watching' ? 'animate-pulse' : ''}`}
                      style={{ background: STATUS_CSS_VARS[m.status] ?? 'white' }}
                    />
                    {STATUS_LABELS[m.status] ?? m.status}
                    <span className="text-text-3">· {m.progress}{m.episodes ? `/${m.episodes}` : ''}</span>
                  </p>
                  <Button onClick={() => onBump(m)} title="Megnéztem egy részt">+1</Button>
                </div>
              }
            />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 8: `WeekCalendar`**

Create `src/components/home/WeekCalendar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import SectionHeader from '@/components/ui/SectionHeader'
import { weekdayIndexBudapest, WEEKDAY_LABELS } from '@/lib/news'
import type { MineItem } from './types'

export default function WeekCalendar({ mine }: { mine: MineItem[] }) {
  if (mine.length === 0) return null
  const todayIdx = weekdayIndexBudapest(Math.floor(Date.now() / 1000))

  return (
    <section>
      <SectionHeader eyebrow="Adásnaptár" title="A heted" />
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS.map((label, day) => {
          const items = mine.filter((m) => weekdayIndexBudapest(m.airingAt) === day)
          const today = day === todayIdx
          return (
            <div
              key={label}
              className={`rounded-[--r-md] p-2 min-h-24 ${today ? 'surface-2' : 'surface-1'}`}
            >
              <p className={`label-mono mb-2 text-center ${today ? '!text-text-1' : ''}`}>{label}</p>
              <div className="flex flex-col items-center gap-1.5">
                {items.map((m) => (
                  <Link key={m.animeId} href={`/anime/${m.animeId}`} title={m.title}>
                    {m.coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.coverUrl}
                        alt={m.title}
                        className="w-9 h-12 object-cover rounded-[--r-sm] hover:scale-110 transition-transform"
                      />
                    ) : (
                      <span className="text-[10px] text-text-2">{m.title.slice(0, 8)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 9: `SeasonGrid`**

Create `src/components/home/SeasonGrid.tsx`:

```tsx
'use client'
import { motion } from 'framer-motion'
import MediaCard from '@/components/MediaCard'
import Countdown from '@/components/Countdown'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import ScoreBadge from '@/components/ui/ScoreBadge'
import EmptyState from '@/components/ui/EmptyState'
import { reveal } from '@/lib/motion'
import SeasonFilterBar from '@/components/SeasonFilterBar'
import { SEASON_LABELS } from '@/lib/seasonal'
import { EMPTY_SEASON_VIEW, type SeasonView } from '@/lib/season-filter'
import type { SeasonItem } from './types'

// a seasonFacets() visszateresi tipusa (src/lib/season-filter.ts:49-53)
type Facets = { genres: string[]; formats: string[]; sites: string[] }

type Props = {
  season: { season: string; year: number }
  items: SeasonItem[]
  visible: SeasonItem[]
  fit: Record<number, number>
  view: SeasonView
  onView: (v: SeasonView) => void
  facets: Facets
  scored: boolean
  scoresFailed: boolean
  onPlan: (anilistId: number) => void
  planned: Set<number>
}

export default function SeasonGrid({
  season, items, visible, fit, view, onView, facets, scored, scoresFailed, onPlan, planned,
}: Props) {
  return (
    <section>
      <SectionHeader
        eyebrow="A szezon"
        title={`${season.year} ${SEASON_LABELS[season.season] ?? season.season}`}
      />
      <div className="mb-5">
        <SeasonFilterBar
          view={view}
          onChange={onView}
          facets={facets}
          shown={visible.length}
          total={items.length}
          scored={scored}
          scoresFailed={scoresFailed}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          eyebrow="Szűrő"
          title="Nincs találat"
          text="A beállított szűrőkre egy cím sem illik. Lazíts az ízlés-küszöbön, vagy vedd le a műfaj-szűrőt."
          action={
            <Button onClick={() => onView({ ...EMPTY_SEASON_VIEW, sort: view.sort })}>
              Szűrők lazítása
            </Button>
          }
        />
      ) : (
        <div
          data-tour="season"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8"
        >
          {visible.map((s, i) => (
            <motion.article key={s.anilistId} {...reveal(i)} className="h-full">
              <MediaCard
                title={s.title}
                coverUrl={s.coverUrl}
                genres={s.genres}
                description={s.description}
                streaming={s.streaming}
                badge={s.tasteScore != null ? (
                  <ScoreBadge score={s.tasteScore} kind="taste" title={s.tasteReason ?? undefined} />
                ) : fit[s.anilistId] != null ? (
                  <ScoreBadge score={fit[s.anilistId]} suffix="%" title="Ennyire illik az ízlésedhez (lokális becslés)" />
                ) : undefined}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[12px] text-text-1">
                      {s.airingAt != null ? (
                        <>EP {s.nextEpisode} · <Countdown airingAt={s.airingAt} /></>
                      ) : (
                        <span className="text-text-3">nincs adásban</span>
                      )}
                    </p>
                    {s.owned ? (
                      <span className="label-mono text-[color:var(--status-watching)]">listádon</span>
                    ) : (
                      <Button onClick={() => onPlan(s.anilistId)} disabled={planned.has(s.anilistId)}>
                        {planned.has(s.anilistId) ? '✓' : '+ Tervezem'}
                      </Button>
                    )}
                  </div>
                }
              />
            </motion.article>
          ))}
        </div>
      )}
    </section>
  )
}
```

A `SeasonView` mezői: `{ sort, genres: string[], formats: string[], sites: string[], minScore }` (`src/lib/season-filter.ts:15-21`). A „Szűrők lazítása" ezért az `EMPTY_SEASON_VIEW`-ra állít vissza, de **megtartja a felhasználó rendezését** — a rendezés nem szűrő, azt nem kell visszaállítani.

- [ ] **Step 10: `NextSeason` — a két szekció egyesítése**

Create `src/components/home/NextSeason.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import MediaCard from '@/components/MediaCard'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { SEASON_LABELS, nextSeason } from '@/lib/seasonal'
import type { NextSeasonRow, UpcomingItem } from './types'

type Props = {
  /** AI-pontozott, szemelyre szabott valogatas */
  upcoming: UpcomingItem[]
  upcomingSeason: { season: string; year: number } | null
  /** a teljes bejelentett kinalat a lokalis katalogusbol */
  all: NextSeasonRow[] | null
  allFit: Record<number, number>
  onPlan: (anilistId: number) => void
  planned: Set<number>
}

// Korabban KET kulon szekcio volt ('neked' + 'teljes kinalat'). Egy szekcio
// togglelel: ugyanaz az informacio, fele annyi vizualis suly.
export default function NextSeason({ upcoming, upcomingSeason, all, allFit, onPlan, planned }: Props) {
  const [mode, setMode] = useState<'mine' | 'all'>(upcoming.length > 0 ? 'mine' : 'all')
  const ns = upcomingSeason ?? nextSeason(new Date())
  if (upcoming.length === 0 && (all == null || all.length === 0)) return null

  const grid = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8'

  return (
    <section>
      <SectionHeader
        eyebrow="Következő szezon"
        title={`${ns.year} ${SEASON_LABELS[ns.season] ?? ns.season}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-full hairline overflow-hidden">
              {([['mine', 'Neked'], ['all', 'Mind']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setMode(k)}
                  disabled={k === 'mine' ? upcoming.length === 0 : all == null || all.length === 0}
                  className={`px-3 py-1.5 text-xs transition-colors disabled:opacity-30 ${
                    mode === k ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
              href="/bongeszo?season=next"
              className="text-xs text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
            >
              Böngészőben →
            </Link>
          </div>
        }
      />

      {mode === 'mine' ? (
        <div className={grid}>
          {upcoming.map((s) => (
            <MediaCard
              key={s.anilistId}
              title={s.title}
              coverUrl={s.coverUrl}
              genres={s.genres}
              description={s.tasteReason}
              streaming={s.streaming}
              badge={<ScoreBadge score={s.tasteScore} kind="taste" title={s.tasteReason} />}
              footer={s.owned ? (
                <span className="label-mono text-[color:var(--status-watching)]">listádon</span>
              ) : (
                <Button onClick={() => onPlan(s.anilistId)} disabled={planned.has(s.anilistId)}>
                  {planned.has(s.anilistId) ? '✓' : '+ Tervezem'}
                </Button>
              )}
            />
          ))}
        </div>
      ) : (
        <div className={grid}>
          {(all ?? []).map((t) => (
            <MediaCard
              key={t.id}
              title={t.titleRomaji}
              coverUrl={t.coverUrl}
              genres={t.genres}
              href={`/${t.mediaType === 'MANGA' ? 'manga' : 'anime'}/${t.slug}`}
              badge={allFit[t.anilistId] != null ? (
                <ScoreBadge score={allFit[t.anilistId]} suffix="%" title="Ennyire illik az ízlésedhez" />
              ) : undefined}
              footer={t.format ? <span className="label-mono">{t.format}</span> : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 11: `SocialFeed`**

Create `src/components/home/SocialFeed.tsx`:

```tsx
'use client'
import Link from 'next/link'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import type { FeedItem, WatchItem } from './types'

type Props = {
  feed: FeedItem[]
  watchlist: WatchItem[]
  usernames: Record<number, string>
  onWatchBump: (w: WatchItem) => void
  onWatchRemove: (w: WatchItem) => void
}

export default function SocialFeed({ feed, watchlist, usernames, onWatchBump, onWatchRemove }: Props) {
  if (feed.length === 0 && watchlist.length === 0) return null

  return (
    <section>
      <SectionHeader eyebrow="Társaság" title="Mi történt" />

      {feed.length > 0 && (
        <div className="surface-1 rounded-[--r-lg] p-4 flex flex-col gap-2.5">
          {feed.slice(0, 12).map((f) => (
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
              <span className="label-mono shrink-0">
                {new Date(f.at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {watchlist.length > 0 && (
        <div className="mt-5">
          <p className="label-mono mb-2">Közös lista</p>
          <ul className="flex flex-col gap-2">
            {watchlist.map((w) => (
              <li key={w.id} className="surface-1 rounded-[--r-md] p-2.5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.coverUrl && <img src={w.coverUrl} alt="" className="w-8 h-11 object-cover rounded-[--r-sm]" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/anime/preview/${w.anilistId}`} className="text-sm font-medium text-text-1 truncate block hover:underline">
                    {w.title}
                  </Link>
                  <p className="label-mono">{usernames[w.addedBy] ?? '?'} tette fel · együtt: {w.watchedEpisodes} rész</p>
                </div>
                <Button onClick={() => onWatchBump(w)} title="Együtt megnéztünk egy részt">+1</Button>
                <Button variant="ghost" onClick={() => onWatchRemove(w)} title="Levétel" className="text-text-3">✕</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 12: `page.tsx` átírása komponálóra**

Írd felül `src/app/page.tsx`-et. Az összes fetch és state marad, csak a JSX kerül a komponensekbe, és **az új sorrend érvényesül**: hero → követett → naptár → szezon → következő szezon → társaság.

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import OnboardingCTA from '@/components/OnboardingCTA'
import RecommendMorph from '@/components/RecommendMorph'
import TonightPicker from '@/components/TonightPicker'
import TourSpotlight from '@/components/TourSpotlight'
import PageShell from '@/components/ui/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import HeroToday from '@/components/home/HeroToday'
import FollowedRow from '@/components/home/FollowedRow'
import WeekCalendar from '@/components/home/WeekCalendar'
import SeasonGrid from '@/components/home/SeasonGrid'
import NextSeason from '@/components/home/NextSeason'
import SocialFeed from '@/components/home/SocialFeed'
import { useFitScores } from '@/lib/use-fit-scores'
import { pickHero } from '@/lib/home-hero'
import { applySeasonView, seasonFacets, EMPTY_SEASON_VIEW, type SeasonView } from '@/lib/season-filter'
import type { TourStep } from '@/lib/tour'
import type {
  NewsData, MineItem, NextSeasonRow, UpcomingItem, WatchItem, FeedItem,
} from '@/components/home/types'

const NEWS_TOUR: TourStep[] = [
  { selector: 'season', title: 'Szezon', text: 'Az aktuális szezon minden címe — a badge azt mutatja, mennyire illik az ízlésedhez. Lista nélkül is él.' },
  { selector: 'recommend', title: 'Ajánlj nekem', text: 'Egy gomb: az AI a listádból és a véleményeidből tanult ízlésed alapján ajánl. Ez a lényeg.' },
  { selector: 'tonight', title: 'Ma este?', text: 'Nincs kedved dönteni? Hangulat + idő alapján kiválasztja, mit nézz ma este.' },
]

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [digest, setDigest] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [wlUsers, setWlUsers] = useState<Record<number, string>>({})
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([])
  const [upcomingSeason, setUpcomingSeason] = useState<{ season: string; year: number } | null>(null)
  const [nextList, setNextList] = useState<NextSeasonRow[] | null>(null)
  const [scores, setScores] = useState<Map<number, { score: number; reason: string }>>(new Map())
  const [scoresFailed, setScoresFailed] = useState(false)
  const [view, setView] = useState<SeasonView>(EMPTY_SEASON_VIEW)

  useEffect(() => {
    fetch('/api/news')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
        setData(await r.json())
      })
      .catch((e) => setError(String(e.message ?? e)))
    fetch('/api/digest')
      .then((r) => r.json())
      .then((j) => setDigest(j.digest ?? null))
      .catch(() => { /* digest nélkül is él az oldal */ })
    fetch('/api/feed')
      .then((r) => r.json())
      .then((j) => setFeed(j.items ?? []))
      .catch(() => { /* feed nélkül is él az oldal */ })
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((j) => { setWatchlist(j.items ?? []); setWlUsers(j.usernames ?? {}) })
      .catch(() => { /* watchlist nélkül is él az oldal */ })
    fetch('/api/browse?season=next&type=ANIME&sort=SCORE_DESC')
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((j: { media: NextSeasonRow[] }) => setNextList((j.media ?? []).slice(0, 18)))
      .catch(() => setNextList([]))
    fetch('/api/news/upcoming')
      .then((r) => r.json())
      .then((j) => { setUpcoming(j.items ?? []); setUpcomingSeason(j.season ?? null) })
      .catch(() => { /* enélkül is él az oldal */ })
    // ízlés-pontok külön csatornán: lassú AI-futás ne késleltesse a rácsot
    fetch('/api/news/season-scores')
      .then(async (r) => {
        const j = await r.json()
        const items: { anilistId: number; score: number; reason: string }[] = j.items ?? []
        if (!r.ok || !items.length) { setScoresFailed(true); return }
        setScores(new Map(items.map((i) => [i.anilistId, { score: i.score, reason: i.reason }])))
      })
      .catch(() => setScoresFailed(true))
  }, [])

  const scored = scores.size > 0
  const seasonItems = useMemo(
    () => (data?.seasonItems ?? []).map((s) => ({
      ...s,
      tasteScore: scores.get(s.anilistId)?.score ?? null,
      tasteReason: scores.get(s.anilistId)?.reason ?? null,
    })),
    [data, scores],
  )
  const facets = useMemo(() => seasonFacets(seasonItems), [seasonItems])
  // pont nélkül az ízlés-rendezés és a küszöb értelmetlen — adásidőre esünk vissza
  const effectiveView = useMemo<SeasonView>(
    () => (scored ? view : { ...view, sort: view.sort === 'taste' ? 'airing' : view.sort, minScore: 0 }),
    [scored, view],
  )
  const visibleSeason = useMemo(() => applySeasonView(seasonItems, effectiveView), [seasonItems, effectiveView])
  const seasonFit = useFitScores(visibleSeason.map((s) => s.anilistId))
  const nextFit = useFitScores((nextList ?? []).map((t) => t.anilistId))

  // a hero-ban szereplo cim ne ismetlodjon a 'Amit kovetsz' racsban
  const heroPick = useMemo(
    () => (data ? pickHero(data.mine, seasonItems, Math.floor(Date.now() / 1000), seasonFit) : null),
    [data, seasonItems, seasonFit],
  )
  const heroAnimeId =
    heroPick && (heroPick.kind === 'airing' || heroPick.kind === 'watching') ? heroPick.item.animeId : undefined

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAdded((s) => new Set(s).add(anilistId))
  }

  async function bumpProgress(m: MineItem) {
    const res = await fetch(`/api/anime/${m.animeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: m.progress + 1 }),
    })
    if (res.ok && data) {
      setData({
        ...data,
        mine: data.mine.map((x) => (x.animeId === m.animeId ? { ...x, progress: x.progress + 1 } : x)),
      })
    }
  }

  async function watchBump(w: WatchItem) {
    const res = await fetch('/api/watchlist', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id, delta: 1 }),
    })
    if (res.ok) setWatchlist((l) => l.map((x) => (x.id === w.id ? { ...x, watchedEpisodes: x.watchedEpisodes + 1 } : x)))
  }

  async function watchRemove(w: WatchItem) {
    const res = await fetch('/api/watchlist', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: w.id }),
    })
    if (res.ok) setWatchlist((l) => l.filter((x) => x.id !== w.id))
  }

  if (error) {
    return (
      <PageShell>
        <EmptyState
          eyebrow="Hírek"
          title="Nem sikerült betölteni"
          text={error}
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="flex flex-col gap-14">
      <HeroToday
        mine={data?.mine ?? null}
        season={seasonItems}
        fit={seasonFit}
        digest={digest}
        onBump={bumpProgress}
        onPlan={addToPlanned}
        planned={added}
      />

      <div className="flex items-center justify-end gap-2 -mt-8">
        <div data-tour="tonight"><TonightPicker /></div>
        <div data-tour="recommend"><RecommendMorph onAdded={() => { /* a lista frissül a következő betöltéskor */ }} /></div>
      </div>

      {data && data.mine.length === 0 && <OnboardingCTA />}
      <TourSpotlight
        page="news"
        steps={NEWS_TOUR}
        force={typeof window !== 'undefined' && window.location.search.includes('tour=1')}
      />

      {data && <FollowedRow mine={data.mine} excludeAnimeId={heroAnimeId} onBump={bumpProgress} />}
      {data && <WeekCalendar mine={data.mine} />}

      {data && (
        <SeasonGrid
          season={data.season}
          items={seasonItems}
          visible={visibleSeason}
          fit={seasonFit}
          view={view}
          onView={setView}
          facets={facets}
          scored={scored}
          scoresFailed={scoresFailed}
          onPlan={addToPlanned}
          planned={added}
        />
      )}

      <NextSeason
        upcoming={upcoming}
        upcomingSeason={upcomingSeason}
        all={nextList}
        allFit={nextFit}
        onPlan={addToPlanned}
        planned={added}
      />

      <SocialFeed
        feed={feed}
        watchlist={watchlist}
        usernames={wlUsers}
        onWatchBump={watchBump}
        onWatchRemove={watchRemove}
      />
    </PageShell>
  )
}
```

**Figyelj:** a `/api/news` hibája már **nem** viszi hibaképernyőre az egész lapot csak akkor, ha ez az egyetlen forrás — a `NextSeason` és a `SocialFeed` a `data`-tól függetlenül renderel. Az `error` ág megmarad, mert a `/api/news` a lap gerince (401-nél a login-átirányítást is ez hozza), de a többi szekció külön hibázhat anélkül, hogy a lap eltűnne.

- [ ] **Step 13: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: 0 `tsc` hiba, teszt-szám baseline+19+11 = **baseline+30**, build zöld.

- [ ] **Step 14: Vizuális ellenőrzés**

`npm run dev`, `http://localhost:3000/` 1440×900 és 390×844. **Nézd meg mindkettőt.** Amit ellenőrizz:
- van egy nagy serif hero legfelül, poszter-színnel a háttérben
- a hero címe **nem** ismétlődik közvetlenül alatta a „Amit követsz" rácsban
- a sorrend: hero → követett → naptár → szezon → következő szezon → társaság
- a „Következő szezon" **egy** szekció `Neked / Mind` togglelel
- 390px-en a hero borító eltűnik (`hidden sm:block`), a cím nem lóg ki, és a `display-xl` `clamp` miatt olvasható marad

- [ ] **Step 15: Commit**

```bash
git add src/lib/home-hero.ts src/lib/home-hero.test.ts src/lib/motion.ts src/components/home src/app/page.tsx
git commit -m "feat(ui): cimlap hero + fajl-szetvagas + uj szekcio-sorrend

pickHero() 11 teszttel: negylepcsos fallback-lanc (kozeli adas -> legtobbet
nezett -> legjobb fit a szezonbol -> ures). Az 530 soros page.tsx het
fetch-csel hat komponensre valt (HeroToday, FollowedRow, WeekCalendar,
SeasonGrid, NextSeason, SocialFeed) + kozos types.ts.
Uj sorrend: hero -> kovetett -> naptar -> szezon -> kovetkezo -> tarsasag
(korabban masok aktivitasa allt a masodik helyen). A ket kovetkezo-szezon
szekcio egybe olvad togglelel.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Címoldal — kinematografikus hero

**Files:**
- Modify: `src/components/CatalogTitlePage.tsx` (208 sor, layout-átírás)

**Interfaces:**
- Consumes: Task 1 osztályok, Task 3 (`SectionHeader`, `Chip`), Task 5 (`PosterAmbient`, `MediaCard` row-variant)
- Produces: semmi új exportot

**KRITIKUS:** ez szerver-komponens ISR-cache-ben. **Ne** adj hozzá `no-store` fetch-et, `cookies()`, `headers()` vagy `getTranslations()` hívást. A szekció-címkék statikus magyar szövegek maradnak.

- [ ] **Step 1: A hero átírása**

`src/components/CatalogTitlePage.tsx` — az importokhoz:
```tsx
import PosterAmbient from '@/components/ui/PosterAmbient'
import SectionHeader from '@/components/ui/SectionHeader'
import Chip from '@/components/ui/Chip'
import MediaCard from '@/components/MediaCard'
```

A `:59-107` blokkot (a fix hátteret és a `<header>`-t) cseréld erre:

```tsx
      {/* full-bleed kinematografikus hero */}
      <div className="relative">
        {/* a .poster-ambient inset:0-t hasznal, ezert egy meretezett wrapper
            hatarolja — nem Tailwind !important-tal irjuk felul */}
        <div className="absolute inset-x-0 top-0 h-[56vh] overflow-hidden pointer-events-none">
          <PosterAmbient src={t.bannerUrl ?? t.coverUrl} intensity="hero" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[56vh] bg-gradient-to-b from-transparent via-[#09090b]/55 to-[#09090b] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 pt-32 pb-8">
          <header className="flex flex-col sm:flex-row gap-7">
            {t.coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={t.coverUrl}
                alt=""
                className="w-40 sm:w-48 rounded-[--r-lg] shadow-2xl shadow-black/70 self-start shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="display-xl text-text-1">{t.titleRomaji}</h1>
              {t.titleNative && (
                <p className="font-jp text-text-3 mt-2 text-lg">{t.titleNative}</p>
              )}
              {t.titleEnglish && t.titleEnglish !== t.titleRomaji && (
                <p className="text-text-2 text-sm mt-1">{t.titleEnglish}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-5">
                {chips.map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
                {t.studio && (
                  <Chip
                    variant="link"
                    href={`/bongeszo?studio=${encodeURIComponent(t.studio)}`}
                    title={`További ${t.studio}-címek a böngészőben`}
                  >
                    {t.studio}
                  </Chip>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {t.genres.map((g) => (
                  <Chip key={g} variant="genre">{g}</Chip>
                ))}
              </div>

              {/* a fit-badge a heroba kerul: a legfontosabb informacio a
                  legerosebb poziciot kapja (korabban kulon kartya volt lejjebb) */}
              <div data-tour="fit" className="mt-5">
                <FitBadge titleId={t.id} />
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <StreamLinks anilistId={t.anilistId} />
                <a
                  href={`https://anilist.co/${t.mediaType === 'MANGA' ? 'manga' : 'anime'}/${t.anilistId}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
                >AniList ↗</a>
              </div>
            </div>
          </header>
        </div>
      </div>
```

A `:67` `<div className="max-w-4xl mx-auto px-4 pt-28 flex flex-col gap-5">` konténer helyére, a hero **után**:
```tsx
      <div className="max-w-5xl mx-auto px-4 pb-24 md:pb-16 flex flex-col gap-14">
```

A `:110-115` blokkból a `<FitBadge …>` sort **töröld** (átkerült a heróba), a `TourSpotlight` és `OwnerOverlay` marad:
```tsx
        <TourSpotlight page="title" steps={TITLE_TOUR} />
        <OwnerOverlay
          titleId={t.id}
          watchlistMeta={{ anilistId: t.anilistId, title: t.titleRomaji, coverUrl: t.coverUrl, mediaType: t.mediaType }}
        />
```

- [ ] **Step 2: A hat szekció `surface-0`-ra**

Leírás (`:117-122`):
```tsx
        {t.description && (
          <section>
            <SectionHeader eyebrow="Leírás" title="Miről szól" />
            <p className="text-[15px] text-text-1 leading-[1.75] max-w-[62ch]">{stripHtml(t.description)}</p>
          </section>
        )}
```

Eredeti mű / adaptáció (`:124-154`) — `MediaCard` row-variant:
```tsx
        {sourceRel && (
          <section>
            <SectionHeader
              eyebrow={t.mediaType === 'MANGA' ? 'Anime-adaptáció' : 'Eredeti mű'}
              title={t.mediaType === 'MANGA' ? 'Ebből készült az anime' : 'Ebből készült ez a feldolgozás'}
            />
            <div className="surface-1 rounded-[--r-lg] p-3 flex items-center gap-4">
              {sourceLocal?.coverUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={sourceLocal.coverUrl} alt="" className="w-16 aspect-[2/3] object-cover rounded-[--r-md] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-tight">{sourceRel.title}</p>
                <p className="label-mono mt-1">{sourceRel.type.toLowerCase().replace('_', ' ')}</p>
              </div>
              {sourceLocal ? (
                <Link
                  href={canonicalPath(sourceLocal.mediaType, sourceLocal.slug)}
                  className="btn-ghost border border-white/12 px-3.5 py-1.5 text-xs shrink-0"
                >Megnyitás →</Link>
              ) : (
                <a
                  href={`https://anilist.co/${t.mediaType === 'MANGA' ? 'anime' : 'manga'}/${sourceRel.anilistId}`}
                  target="_blank" rel="noreferrer"
                  className="btn-ghost border border-white/12 px-3.5 py-1.5 text-xs shrink-0"
                >AniList ↗</a>
              )}
            </div>
          </section>
        )}
```

Stáb (`:158-178`) — snap-scroll sáv a `flex-wrap` helyett:
```tsx
        {staff.length > 0 && (
          <section>
            <SectionHeader eyebrow="Stáb" title="Kik csinálták" />
            <div className="snap-row no-scrollbar pb-2">
              {staff.map((s) => (
                <div key={s.staffId} className="flex items-center gap-2.5 surface-1 rounded-full pl-1 pr-4 py-1">
                  {s.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.image} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight whitespace-nowrap">{s.name}</p>
                    <p className="label-mono leading-tight">{s.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
```

Kapcsolódó (`:188-204`) — `MediaCard` row-variant a csupasz link-lista helyett:
```tsx
        {otherRelations.length > 0 && (
          <section>
            <SectionHeader eyebrow="Kapcsolódó" title="A sorozat többi része" />
            <ul className="surface-1 rounded-[--r-lg] p-2 flex flex-col">
              {otherRelations.map((r) => (
                <li key={`${r.type}-${r.anilistId}`}>
                  <MediaCard
                    variant="row"
                    title={r.title}
                    coverUrl={null}
                    genres={[r.type.toLowerCase().replace('_', ' ')]}
                    footer={
                      <a
                        href={`https://anilist.co/anime/${r.anilistId}`}
                        target="_blank" rel="noreferrer"
                        className="label-mono hover:text-text-1"
                      >AniList ↗</a>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
```

- [ ] **Step 3: A `main` és a fix háttér rendezése**

A `:54` `<main className="min-h-screen pb-16">` marad, de a `pb-16` → `pb-0` (a belső konténer viszi a `pb`-t). A `:59-65` régi fix hátteret (`fixed inset-x-0 top-0 h-[42vh] -z-10 …`) **töröltük** — ellenőrizd, hogy nem maradt bent duplán.

- [ ] **Step 4: Ellenőrzés — itt a prod-build a kritikus**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: 0 `tsc` hiba, teszt-szám változatlan (baseline+30), és a build **végigfut**. A route-listában a `/anime/[slug]` és `/manga/[slug]` mellett `●` (SSG/ISR) kell álljon, **nem** `ƒ` (Dynamic). Ha `ƒ`-re váltott, dinamikus API csúszott be — keresd meg és vedd ki, **ne** menj tovább.

- [ ] **Step 5: Vizuális ellenőrzés prod-módban**

```bash
npm run build && npm start
```

Playwright MCP-vel egy valódi címoldal (a `/bongeszo`-ból kattints át egy címre, hogy érvényes slugot kapj) 1440×900 és 390×844. **Nézd meg mindkettőt.** Amit ellenőrizz:
- nagy serif cím, alatta a japán cím `font-jp`-vel
- a banner színe lefolyik a lapba, nincs kemény vágás
- a fit-badge a heróban van, nem lejjebb
- a leírás sorai rövidek (62ch), nem futnak végig
- a stáb vízszintesen scrollozható, nem tördel négy sorba
- 390px-en a borító a cím fölé kerül (`flex-col`), semmi nem lóg ki

- [ ] **Step 6: Commit**

```bash
git add src/components/CatalogTitlePage.tsx
git commit -m "feat(ui): cimoldal kinematografikus hero

Full-bleed poszter-ambiens hero display-xl cimmel es font-jp japan cimmel,
a fit-badge a heroba kerult (korabban kulon kartya lejjebb — a legfontosabb
informacio a leggyengebb pozicioban). Hat uveg-kartya szekcio surface-0-ra
whitespace-elvalasztassal, leiras 62ch-ra, stab vizszintes snap-savra,
kapcsolodo cimek row-variant kartyara.
ISR-korlat betartva: nincs uj dinamikus API a szerver-komponensben.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `/lista` — sűrűség-pass

**Files:**
- Modify: `src/app/lista/page.tsx`

**Interfaces:**
- Consumes: Task 1 osztályok, Task 3 (`PageShell`, `Button`), Task 4 (`EmptyState`)
- Produces: semmi új exportot

A `<table>` **marad táblázat**: a rendezhető fejléc (`sortBy`, `sortKey`, `sortDir`) a lista fő funkciója; kártya-rácsra cserélve elveszne.

- [ ] **Step 1: Shell, fejléc, `EmptyState`**

Importok:
```tsx
import PageShell from '@/components/ui/PageShell'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
```

`:131` — `<main …>` → `<PageShell width="wide">`, a záró `</main>` (`:265`) → `</PageShell>`.

`:133` — a cím:
```tsx
        <h1 className="display-l text-text-1 mr-auto">Lista</h1>
```

`:190` — a tábla-wrapper:
```tsx
      <div className="surface-1 rounded-[--r-lg] overflow-hidden">
```

`:193` — sticky fejléc:
```tsx
          <thead className="sticky top-[4.5rem] z-20 backdrop-blur-md bg-[#0d0d10]/85">
            <tr className="border-b border-white/8">
```

`:247-253` — az üres ág:
```tsx
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6">
                  {list.length === 0 ? (
                    <OnboardingCTA compact />
                  ) : (
                    <EmptyState
                      eyebrow="Szűrő"
                      title="Nincs találat"
                      text="Erre a szűrőre és keresésre egy cím sem illik a listádon."
                      action={
                        <Button onClick={() => { setQ(''); setFilter('all'); setAiAnswer(null); setAiMatches(null) }}>
                          Szűrők törlése
                        </Button>
                      }
                    />
                  )}
                </td>
              </tr>
            )}
```

- [ ] **Step 2: Progress-oszlop és `+1` gomb**

A `<thead>`-be, a `Státusz` és `Pont` közé:
```tsx
              <th className="px-3 py-2.5 text-left hidden lg:table-cell">
                <span className="label-mono">Haladás</span>
              </th>
```

A `<tbody>` sorába, a status-cella után:
```tsx
                <td className="px-3 py-2 hidden lg:table-cell w-28">
                  {a.episodes ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/45"
                          style={{ width: `${Math.min(100, Math.round((a.progress / a.episodes) * 100))}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-text-3 tabular-nums shrink-0">
                        {a.progress}/{a.episodes}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-text-3">{a.progress || '–'}</span>
                  )}
                </td>
```

És az utolsó (📌) cella **elé** egy `+1` cella:
```tsx
                <td className="px-2 py-2 text-right">
                  <Button
                    onClick={(e) => { e.stopPropagation(); bumpOne(a) }}
                    title="Megnéztem egy részt"
                    className="opacity-40 group-hover:opacity-100 transition-opacity"
                  >
                    +1
                  </Button>
                </td>
```

A `<tr>`-re vedd fel a `group` osztályt, hogy a `group-hover` működjön.

A `colSpan={7}` → `colSpan={9}` mindenhol (a `thead` most 9 cellás: kép, cím, év, stúdió, státusz, haladás, pont, +1, 📌).

Az új handler a komponensbe, a `togglePin` mellé:
```tsx
  async function bumpOne(a: ApiAnime) {
    const res = await fetch(`/api/anime/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: a.progress + 1 }),
    })
    if (res.ok) {
      setList((l) => l.map((x) => (x.id === a.id ? { ...x, progress: x.progress + 1 } : x)))
    }
  }
```

- [ ] **Step 3: Sor-hover poszter-glow**

A `<tr>` osztálylistája:
```tsx
                className="group relative border-b border-white/5 last:border-0 hover:bg-white/[0.035] cursor-pointer transition-colors"
```

A borító-cellába, a `<img>` mellé egy dekoratív glow:
```tsx
                <td className="pl-3 py-2 relative">
                  {a.coverUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.coverUrl} alt="" aria-hidden
                        className="poster-glow opacity-0 group-hover:opacity-45"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.coverUrl} alt="" className="relative w-9 h-12 object-cover rounded-[--r-sm]" />
                    </>
                  )}
                </td>
```

- [ ] **Step 4: Ellenőrzés**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -5
npm run build
```

Expected: 0 `tsc` hiba, teszt-szám baseline+30, build zöld.

Ha a `tsc` a `Button` `onClick` `e` paraméterére panaszkodik: a `Button` `ButtonHTMLAttributes<HTMLButtonElement>`-et terjeszt, tehát az `e` típusa `React.MouseEvent<HTMLButtonElement>` — ez helyes, `e.stopPropagation()` létezik rajta.

- [ ] **Step 5: Vizuális ellenőrzés**

`npm run dev`, `http://localhost:3000/lista` 1440×900 és 390×844. **Nézd meg.** Amit ellenőrizz:
- a fejléc scrollnál megáll a nav alatt, nem csúszik el
- a rendezés **továbbra is működik** (kattints a `Cím` és az `Év` fejlécre → `browser_take_screenshot` mindkettő után)
- hoverre látszik a poszter-glow a sor bal szélén, és megjelenik a `+1`
- a `+1` kattintás nem navigál a detail-oldalra (a `stopPropagation` miatt), és a progress-sáv nő
- 390px-en a `Haladás`, `Év`, `Stúdió` oszlop rejtve, a tábla nem lóg ki vízszintesen

- [ ] **Step 6: Commit**

```bash
git add src/app/lista/page.tsx
git commit -m "feat(ui): lista suruseg-pass — sticky fejlec, haladas-sav, +1 a soron

A tabla tabla marad: a rendezheto fejlec a lista fo funkcioja. Uj: sticky
thead, haladas-oszlop progress-savval (korabban csak a detail-oldalon
latszott), egykattintasos +1 a soron, poszter-glow sor-hoveren, EmptyState
a 'Nincs talalat.' helyere.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Záró verifikáció és regresszió-átnézés

A scope-on kívüli 13 oldal a token- és primitív-csere miatt **változott**. Nem tervezzük újra őket, de nem is hagyjuk eltörve.

**Files:**
- Modify: csak amit a regresszió-átnézés valóban eltörtnek talál
- Modify: `docs/FUNKCIOK.md` (a redesign rögzítése)

**Interfaces:**
- Consumes: minden korábbi task
- Produces: semmi új exportot

- [ ] **Step 1: A négy kapu, sorban**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -8
npm run lint
npm run build
```

Expected: `tsc` 0 hiba; a teszt-szám **baseline+30** (7 score-color + 12 nav + 11 home-hero) és minden zöld; a `lint` hibátlan (figyelmeztetés megengedett); a build végigfut.

A build route-listájában ellenőrizd, hogy `/anime/[slug]` és `/manga/[slug]` **`●`** (prerendered/ISR) és nem `ƒ` (dynamic). Ha `ƒ`, állj meg: dinamikus API csúszott az ISR-oldalba.

- [ ] **Step 2: Prod-szerver indítása**

```bash
npm start
```

Ez a lényeges: `next dev` nem reprodukálja az ISR-500-at.

- [ ] **Step 3: A 4 kulcsoldal screenshot-kör — 390px és 1440px**

Playwright MCP-vel, `http://localhost:3000` ellen. Minden oldalra `browser_resize` → `browser_navigate` → `browser_take_screenshot`, és **minden képet nézz meg**:

| Oldal | 1440×900 | 390×844 |
|---|---|---|
| `/` | ☐ | ☐ |
| egy címoldal (`/anime/<slug>`) | ☐ | ☐ |
| `/bongeszo` | ☐ | ☐ |
| `/lista` | ☐ | ☐ |

Ha bármelyiken vízszintes scroll, átfedő elem, olvashatatlan kontraszt vagy a mobil tab-sáv alá csúszó tartalom van — javítsd, és futtasd újra a Step 1 kapukat.

- [ ] **Step 4: A 13 scope-on kívüli oldal regresszió-átnézése**

Ugyanígy, de csak 1440×900-on, és csak **eltörést** keresve (nem szépséghibát):

`/graf` · `/vibe` · `/wrapped` · `/stats` · `/vs` · `/toplista` · `/velemenyek` · `/beallitasok` · `/onboarding` · `/u/<username>` · `/anime/preview/<anilistId>`

(A `/login` és `/p/<token>` a `isNavHidden` miatt nav nélkül renderel — ellenőrizd, hogy tényleg nincs se felső pill, se alsó tab-sáv rajtuk.)

Amit keresel:
- eltűnt vagy láthatatlan szöveg (a `--status-*` színek hangolása miatt)
- a `9999`-es szemcse-overlay elfog-e valamilyen interakciót (nem szabad — `pointer-events: none`) — a `/graf` 3D-gráfját **próbáld ki**: `browser_click` a vásznon, forgat-e
- a `/graf` és `/vibe` fullscreen-canvas oldalain a `PageShell`-t nem vezettük be — ellenőrizd, hogy a mobil tab-sáv nem fedi le a vezérlőket; ha igen, adj nekik `pb-24 md:pb-0`-t

Amit **nem** javítasz: elcsúszott térközök, régi `label-mono`-only fejlécek, `glass` kártyák. Ezek a következő kör.

- [ ] **Step 5: Dokumentálás**

`docs/FUNKCIOK.md` — vedd fel egy szakaszt a redesignról: mi változott (token-réteg, primitív-készlet `src/components/ui/`-ban, nav-szerkezet, a 4 átírt oldal), mi maradt szándékosan (a 13 oldal layout-ja, i18n-maradék), és hogy a `CatalogTitlePage` ISR-korlátja miért él. Hivatkozz a specre: `docs/superpowers/specs/2026-07-26-ui-redesign-design.md`.

- [ ] **Step 6: Záró commit**

```bash
git add -A
git commit -m "docs: UI-redesign dokumentalasa + regresszio-javitasok

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Összegzés a felhasználónak**

Jelentsd:
- a baseline és a záró teszt-darabszám (`N` → `N+31`)
- `tsc`, `lint`, `build`, `npm start` állapota
- hány screenshotot néztél meg, és mit javítottál utánuk
- a commit-lista (`git log --oneline master..feature/ui-redesign`)
- **hogy a push és a Vercel-deploy a useren van** — te nem pusholsz

---

## Ellenőrzési összefoglaló

| Task | Új teszt | Kumulált |
|---|---|---|
| 1 | 0 (CSS/font) | baseline |
| 2 | 7 (`score-color`) | +7 |
| 3 | 0 | +7 |
| 4 | 0 | +7 |
| 5 | 0 | +7 |
| 6 | 12 (`nav`) | +19 |
| 7 | 11 (`home-hero`) | +30 |
| 8 | 0 | +30 |
| 9 | 0 | +30 |
| 10 | 0 | +30 |

Minden task végén kötelező: `npx tsc --noEmit` + `npm test`. A 3-astól kezdve `npm run build` is. A 8-astól `npm start` + screenshot.
