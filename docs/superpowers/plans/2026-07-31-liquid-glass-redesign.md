# Liquid Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az egész app áttér a liquid glass design-nyelvre: üveg-felületek átszűrődő fénnyel, kurzorkövető specular, fluid framer-motion mozgás, Inter tipográfia — a spec szerint (`docs/superpowers/specs/2026-07-31-liquid-glass-redesign-design.md`).

**Architecture:** Először a globális rétegek (font, CSS-tokenek, fény-réteg, specular-tracker, motion-tokenek), utána a primitívek (Button, Chip, Skeleton), végül oldalanként a komponensek. Minden mozgás a `src/lib/motion.ts` közös tokenjeiből jön.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4 (CSS-first, globals.css), framer-motion 12, next/font, vitest.

## Global Constraints

- Ág: `feature/liquid-glass`. Commit minden task végén.
- `template.tsx`-ben transform TILOS (position:fixed overlay-eket törne) — opacity-only.
- Csak `transform`/`opacity` animálható; `width/height/top/left` soha.
- Fluid easing mindenhol: `cubic-bezier(0.32,0.72,0,1)`; micro 300ms / belépés 500ms / kilépés 350ms.
- Mint-zöld (`#7fd8ad`) UI-akcentként tilos; státusz-dot adatszínként marad.
- Backdrop-filter budget: igazi blur csak nav/modál/hero/tabok/kiemelt panelek; rácsokban `.glass-lite` (blur nélkül).
- `prefers-reduced-motion`: ambient áll, reveal instant.
- Verifikáció minden task után: `npx vitest run` érintett teszt + a task végi állapotban `npx tsc --noEmit`; vizuális taskoknál dev-szerver + Playwright-screenshot.
- A 455 vitest-teszt zölden marad; a végén `npm test` + `next build` kötelező.

---

### Task 1: Inter font-váltás

**Files:**
- Modify: `src/app/layout.tsx:1-33` (font-importok)
- Modify: `src/app/globals.css` (`--font-sans`, `--font-display`, `.display-*` osztályok, body font-family)

**Interfaces:**
- Produces: `--font-inter` CSS-változó; `--font-display` és `--font-sans` erre mutat. Bricolage/Instrument import törölve.

- [ ] **Step 1: layout.tsx font-csere**

```tsx
import { Inter, Geist_Mono, Noto_Sans_JP } from "next/font/google";

// Egyetlen sans-család: Inter. A display-fokozatok súllyal+trackinggel
// különülnek el, nem külön fonttal.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});
```

A body className-ben `instrument.variable` és `bricolage.variable` helyett `inter.variable`. A `geistMono` és `notoJp` marad.

- [ ] **Step 2: globals.css font-referenciák**

- `--font-sans: var(--font-inter), var(--font-noto-jp), sans-serif;`
- `--font-display: var(--font-inter), sans-serif;` (@theme inline blokkban is)
- body `font-family: var(--font-inter), var(--font-noto-jp), Arial, sans-serif;`
- `.display-xl/.display-l/.display-m` (grep: `font-bricolage`): `font-family: var(--font-inter), sans-serif; font-weight: 800; letter-spacing: -0.03em;` — a `wdth`/`font-variation-settings` sorok törlendők (Internek nincs wdth tengelye).
- Grep `--font-instrument` és `--font-bricolage` a teljes src-re; minden találat átírandó `--font-inter`-re.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — Expected: 0 hiba. `npm run dev` + főoldal-screenshot: minden szöveg Inter, magyar ő/ű a display-címekben is rendben (latin-ext).

- [ ] **Step 4: Commit** — `git commit -m "feat: Inter font-valtas Instrument+Bricolage helyett"`

---

### Task 2: Glass token-réteg a globals.css-ben

**Files:**
- Modify: `src/app/globals.css:13-27` (surface-skála → glass-skála) + új szekciók a fájl végén

**Interfaces:**
- Produces: `.glass-1/.glass-2/.glass-3` (igazi blur + specular + él-csillanás), `.glass-lite` (pszeudo-üveg), `.text-silver` (gradiens-cím), `--fluid`, `--dur-micro/enter/exit` tokenek. A meglévő `--surface-*` és `--glass-*` aliasok az új értékekre mutatnak (a 13 nem átírt oldal automatikusan követ).

- [ ] **Step 1: Tokenek a :root-ba**

```css
  /* ── liquid glass skála ─────────────────────────────── */
  --glass-1-bg: rgba(255, 255, 255, 0.035);
  --glass-2-bg: rgba(255, 255, 255, 0.05);
  --glass-3-bg: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-highlight: rgba(255, 255, 255, 0.14);
  --glass-blur-1: 16px;
  --glass-blur-2: 24px;
  --glass-blur-3: 32px;

  /* ── fluid mozgás ───────────────────────────────────── */
  --fluid: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-micro: 300ms;
  --dur-enter: 500ms;
  --dur-exit: 350ms;
```

A meglévő `--surface-1/2/3-bg` értékei a glass-értékekre állítandók (`var(--glass-1-bg)` stb.), `--surface-*-border: var(--glass-border)` — így a régi osztályokat használó oldalak is elmozdulnak.

- [ ] **Step 2: Osztályok**

```css
.glass-1, .glass-2, .glass-3 {
  position: relative;
  border: 1px solid var(--glass-border);
  box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.7),
              inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transition: transform var(--dur-enter) var(--fluid),
              box-shadow var(--dur-enter) var(--fluid),
              border-color var(--dur-micro) ease,
              background var(--dur-micro) ease;
}
.glass-1 { background: var(--glass-1-bg); backdrop-filter: blur(var(--glass-blur-1)) saturate(170%); -webkit-backdrop-filter: blur(var(--glass-blur-1)) saturate(170%); }
.glass-2 { background: var(--glass-2-bg); backdrop-filter: blur(var(--glass-blur-2)) saturate(170%); -webkit-backdrop-filter: blur(var(--glass-blur-2)) saturate(170%); }
.glass-3 { background: var(--glass-3-bg); backdrop-filter: blur(var(--glass-blur-3)) saturate(170%); -webkit-backdrop-filter: blur(var(--glass-blur-3)) saturate(170%); }

/* pszeudo-üveg: rácsokba, backdrop-filter nélkül (GPU-budget) */
.glass-lite {
  position: relative;
  background: var(--glass-1-bg);
  border: 1px solid var(--glass-border);
  box-shadow: 0 12px 30px -14px rgba(0, 0, 0, 0.6),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* kurzorkövető specular — a SpecularTracker állítja a --mx/--my-t */
.glass-1::before, .glass-2::before, .glass-3::before {
  content: "";
  position: absolute; inset: 0; border-radius: inherit;
  pointer-events: none; z-index: 0;
  background: radial-gradient(340px circle at var(--mx, 50%) var(--my, -30%),
    rgba(255, 255, 255, 0.09), transparent 65%);
  opacity: 0; transition: opacity var(--dur-enter) ease;
}
.glass-1:hover::before, .glass-2:hover::before, .glass-3:hover::before { opacity: 1; }

/* felső él-csillanás */
.glass-1::after, .glass-2::after, .glass-3::after, .glass-lite::after {
  content: "";
  position: absolute; inset: 0 0 auto 0; height: 1px; border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(90deg, transparent 5%, rgba(255, 255, 255, 0.35) 30%,
    rgba(255, 255, 255, 0.1) 55%, transparent 90%);
  opacity: 0.55;
}

/* ezüst gradiens-cím */
.text-silver {
  background: linear-gradient(100deg, #fafafa, #c9ccd4 45%, #8f939c);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

@media (max-width: 768px) {
  :root { --glass-blur-1: 8px; --glass-blur-2: 12px; --glass-blur-3: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .glass-1, .glass-2, .glass-3, .glass-lite { transition-duration: 0.01ms; }
}
```

- [ ] **Step 3: btn-solid / btn-ghost üvegesítése** — grep `btn-solid|btn-ghost` a globals.css-ben; a meglévő definíciók üveg-pillre állítandók (glass-2 jellemzők + `border-radius: 999px`), mint-szín nélkül.

- [ ] **Step 4: Verify** — `npm run dev`, főoldal + bongeszo screenshot: felületek üvegesek, semmi nem tört el vizuálisan. `npx tsc --noEmit` zöld.

- [ ] **Step 5: Commit** — `git commit -m "feat: liquid glass token-reteg (glass-1/2/3, glass-lite, specular, text-silver, fluid tokenek)"`

---

### Task 3: `src/lib/motion.ts` közös motion-tokenek + teszt

**Files:**
- Create: `src/lib/motion.ts`
- Test: `src/lib/motion.test.ts`

**Interfaces:**
- Produces: `fluidEase: readonly number[]`, `springFluid`, `tweenFluid`, `tweenExit`, `fadeUp: Variants`, `staggerContainer(delay?: number): Variants`, `cardHover`, `tapScale`, `viewportOnce`. Minden későbbi task innen importál.

- [ ] **Step 1: Failing teszt**

```ts
import { describe, it, expect } from 'vitest'
import { fluidEase, springFluid, tweenFluid, tweenExit, fadeUp, staggerContainer, cardHover, tapScale, viewportOnce } from './motion'

describe('motion tokens', () => {
  it('fluid easing a spec szerinti görbe', () => {
    expect(fluidEase).toEqual([0.32, 0.72, 0, 1])
  })
  it('kilépés rövidebb mint belépés', () => {
    expect(tweenExit.duration).toBeLessThan(tweenFluid.duration)
  })
  it('spring ~5% túllövésre hangolt', () => {
    expect(springFluid).toMatchObject({ type: 'spring', stiffness: 260, damping: 30 })
  })
  it('fadeUp csak transform/opacity kulcsokat animál', () => {
    expect(Object.keys(fadeUp.hidden)).toEqual(expect.arrayContaining(['opacity', 'y']))
    expect(fadeUp.hidden).not.toHaveProperty('width')
    expect(fadeUp.hidden).not.toHaveProperty('height')
  })
  it('staggerContainer alapértelmezett 80ms lépcső', () => {
    const v = staggerContainer()
    expect(v.show.transition.staggerChildren).toBeCloseTo(0.08)
  })
  it('hover/tap tokenek', () => {
    expect(cardHover).toMatchObject({ y: -4, scale: 1.015 })
    expect(tapScale).toEqual({ scale: 0.97 })
    expect(viewportOnce).toEqual({ once: true, amount: 0.2 })
  })
})
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/motion.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implementáció**

```ts
// Közös motion-tokenek — MINDEN animáció innen. Inline timing tilos:
// egy ritmus az egész appban (spec: fluid 400-600ms, kilépés rövidebb).
export const fluidEase = [0.32, 0.72, 0, 1] as const

export const springFluid = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const
export const tweenFluid = { duration: 0.5, ease: fluidEase } as const
export const tweenExit = { duration: 0.35, ease: fluidEase } as const

export const fadeUp = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: tweenFluid },
} as const

export const staggerContainer = (delay = 0.08) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
}) as const

export const cardHover = { y: -4, scale: 1.015, transition: springFluid } as const
export const tapScale = { scale: 0.97 } as const
export const viewportOnce = { once: true, amount: 0.2 } as const
```

(Típus: ha a framer `Variants`/`Transition` típusaival ütközik a `as const`, a konkrét framer-típusannotáció használandó — `import type { Variants, Transition } from 'framer-motion'`.)

- [ ] **Step 4: Run** — `npx vitest run src/lib/motion.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: kozos motion-tokenek (lib/motion.ts) tesztekkel"`

---

### Task 4: GlowField ambient fény-réteg

**Files:**
- Create: `src/components/GlowField.tsx`
- Modify: `src/app/layout.tsx` (mount a body elején), `src/app/globals.css` (orb-stílusok)

**Interfaces:**
- Produces: `<GlowField />` — fixed, z-0, pointer-events-none; a tartalom `relative z-[1]`-en marad.

- [ ] **Step 1: Komponens**

```tsx
// Ambient fény-réteg a tartalom MÖGÖTT: semleges orbok lassú driftje.
// Szerver-komponens — nincs state, nincs effect, csak DOM.
export default function GlowField() {
  return (
    <div className="glow-field" aria-hidden>
      <i className="glow-orb glow-orb-1" />
      <i className="glow-orb glow-orb-2" />
      <i className="glow-orb glow-orb-3" />
      <i className="glow-orb glow-orb-4" />
    </div>
  )
}
```

- [ ] **Step 2: CSS a globals.css-be**

```css
.glow-field { position: fixed; inset: 0; z-index: 0; pointer-events: none; filter: blur(70px); }
.glow-orb { position: absolute; border-radius: 50%; mix-blend-mode: screen; }
.glow-orb-1 { width: 520px; height: 520px; left: -6%; top: 4%;
  background: radial-gradient(circle, rgba(255,255,255,0.10), transparent 65%);
  animation: glow-d1 26s ease-in-out infinite alternate; }
.glow-orb-2 { width: 460px; height: 460px; right: -4%; top: 22%;
  background: radial-gradient(circle, rgba(198,204,216,0.09), transparent 65%);
  animation: glow-d2 32s ease-in-out infinite alternate; }
.glow-orb-3 { width: 420px; height: 420px; left: 32%; bottom: -10%;
  background: radial-gradient(circle, rgba(158,163,175,0.08), transparent 65%);
  animation: glow-d1 38s ease-in-out infinite alternate-reverse; }
.glow-orb-4 { width: 300px; height: 300px; left: 55%; top: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.07), transparent 65%);
  animation: glow-d2 24s ease-in-out infinite alternate-reverse; }
@keyframes glow-d1 { to { transform: translate(80px, 50px) scale(1.15); } }
@keyframes glow-d2 { to { transform: translate(-60px, 70px) scale(0.93); } }
@media (max-width: 768px) { .glow-orb-3, .glow-orb-4 { display: none; } }
@media (prefers-reduced-motion: reduce) { .glow-orb { animation: none; } }
```

- [ ] **Step 3: Mount a layoutban** — a `<body>` első gyereke `<GlowField />`, a meglévő tartalom-wrapper `relative z-[1]` (ellenőrizd: a body::after filmszemcse z-9999 marad felül).

- [ ] **Step 4: Verify** — dev + screenshot: finom fényfoltok úsznak a háttérben minden oldalon; 3D-gráf oldalon nem fogja el az interakciót (pointer-events: none).

- [ ] **Step 5: Commit** — `git commit -m "feat: GlowField ambient feny-reteg a layoutban"`

---

### Task 5: SpecularTracker (kurzorkövető csillanás)

**Files:**
- Create: `src/components/SpecularTracker.tsx`
- Modify: `src/app/layout.tsx` (mount)

**Interfaces:**
- Consumes: `.glass-1/.glass-2/.glass-3` osztályok (Task 2) — `--mx/--my` CSS-varokat állítja rajtuk.
- Produces: `<SpecularTracker />` — render-nélküli client-komponens.

- [ ] **Step 1: Komponens**

```tsx
'use client'
import { useEffect } from 'react'

// EGY globális pointermove-listener adja az összes üvegfelület
// kurzorkövető csillanását. rAF-throttle + proximity-szűrés: csak a
// kurzor 120px-es körzetében lévő üvegek frissülnek. Touch-on inaktív.
export default function SpecularTracker() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const glasses = document.querySelectorAll<HTMLElement>('.glass-1, .glass-2, .glass-3')
        for (const el of glasses) {
          const r = el.getBoundingClientRect()
          if (r.bottom < -120 || r.top > innerHeight + 120) continue
          if (e.clientX < r.left - 120 || e.clientX > r.right + 120 ||
              e.clientY < r.top - 120 || e.clientY > r.bottom + 120) continue
          el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
          el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
        }
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return null
}
```

- [ ] **Step 2: Mount a layoutban** a GlowField mellé.

- [ ] **Step 3: Verify** — dev: hover egy üveg-kártyán, a csillanás követi a kurzort; DevTools Performance: pointermove alatt nincs 16ms feletti frame.

- [ ] **Step 4: Commit** — `git commit -m "feat: SpecularTracker — kurzorkoveto csillanas minden uvegen"`

---

### Task 6: ui-primitívek — Button, Chip

**Files:**
- Modify: `src/components/ui/Button.tsx`, `src/components/ui/Chip.tsx`

**Interfaces:**
- Consumes: `springFluid`, `tapScale` a `@/lib/motion`-ből; `.glass-2` osztály.
- Produces: Button API változatlan (`variant/size/loading` prop-ok) — hívói nem módosulnak.

- [ ] **Step 1: Button framer-esítése**

```tsx
'use client'
import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { springFluid, tapScale } from '@/lib/motion'

const VARIANTS = {
  solid: 'btn-solid',
  ghost: 'btn-ghost',
  outline: 'btn-ghost border border-white/12 hover:border-white/30',
} as const

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
} as const

type Props = HTMLMotionProps<'button'> & {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  loading?: boolean
  children: ReactNode
}

export default function Button({
  variant = 'outline', size = 'sm', loading = false,
  disabled, className = '', children, ...rest
}: Props) {
  return (
    <motion.button
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { scale: 1.03, transition: springFluid }}
      whileTap={disabled || loading ? undefined : tapScale}
      className={`${VARIANTS[variant]} ${SIZES[size]} whitespace-nowrap transition-colors disabled:opacity-40 ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </motion.button>
  )
}
```

FIGYELEM: a `HTMLMotionProps<'button'>` és a régi `ButtonHTMLAttributes` között ütköző event-típusok (`onDrag` stb.) lehetnek — ha egy hívó panaszkodik tsc-n, ott a prop átnevezendő/kiszűrendő.

- [ ] **Step 2: Chip** — ugyanez a minta: `motion.button`/`motion.span`, `whileHover={{ scale: 1.04 }}`, `whileTap={tapScale}`, üveg-pill osztályok.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` (hívóhelyek!), dev: gombok springesen reagálnak.

- [ ] **Step 4: Commit** — `git commit -m "feat: Button+Chip uveg-pill framer hover/tap-pel"`

---

### Task 7: MediaCard — üvegkeret + halo + fluid hover

**Files:**
- Modify: `src/components/MediaCard.tsx`

**Interfaces:**
- Consumes: `cardHover`, `springFluid` a `@/lib/motion`-ből; `.glass-lite` (rács-budget!).
- Produces: MediaCard API változatlan (Props ugyanaz).

- [ ] **Step 1: Poster-variáns átépítése**

- A gyökér `div.group` → `motion.div` `whileHover={cardHover}`-rel (`'use client'` direktíva kell a fájl tetejére).
- A `cover` blokk wrapper-e `.glass-lite rounded-[var(--r-lg)] p-1.5` — üvegkeret, de backdrop-filter NÉLKÜL (rácsokban él).
- A meglévő `poster-glow` img (83-86. sor) marad a halo: alap opacity `opacity-25`, hoverre `group-hover:opacity-60` — így a fény idle-ben is dereng (spec: „mögöttük a saját fényük").
- A poster `group-hover:scale-[1.04]` CSS-transition marad (kompozit a framer-es lift-tel).
- `row`-variáns: gyökér `hover:bg-white/4` helyett `.glass-lite` + a sor `motion.div whileHover={{ x: 6, transition: springFluid }}`.

- [ ] **Step 2: Verify** — dev: bongeszo + lista oldalon kártya-hover: emelkedés + halo + poszter-zoom együtt, 60fps.

- [ ] **Step 3: Commit** — `git commit -m "feat: MediaCard uvegkeret + idle-halo + fluid hover"`

---

### Task 8: TopNav + MobileTabBar — üveg-sáv, úszó aktív-jelölő

**Files:**
- Modify: `src/components/TopNav.tsx`, `src/components/MobileTabBar.tsx`

**Interfaces:**
- Consumes: `springFluid` a `@/lib/motion`-ből; `.glass-3`.
- Produces: nav-API változatlan.

- [ ] **Step 1: TopNav** — a nav-konténer `.glass-3` (igazi blur — budget-en belül, 1 elem). Az aktív link jelölése framer `layoutId`-vel:

```tsx
{links.map((l) => (
  <Link key={l.href} href={l.href} className="relative px-3 py-1.5">
    {isActive(l.href) && (
      <motion.span
        layoutId="nav-active"
        className="absolute inset-0 rounded-full bg-white/10 border border-white/14"
        transition={springFluid}
      />
    )}
    <span className="relative z-[1]">{l.label}</span>
  </Link>
))}
```

(A tényleges link-render a meglévő struktúrához igazítandó — a lényeg: EGY `layoutId="nav-active"` span, ami route-váltásnál átúszik.)

- [ ] **Step 2: MobileTabBar** — ugyanez `layoutId="tab-active"`-vel; a sáv `.glass-3` + safe-area padding marad.

- [ ] **Step 3: Verify** — dev: nav-kattintásnál a jelölő folyékonyan átúszik; mobil-nézetben tabbar üveges, jelölő úszik.

- [ ] **Step 4: Commit** — `git commit -m "feat: TopNav+MobileTabBar uveg-sav, layoutId aktiv-jelolo"`

---

### Task 9: template.tsx időzítés-hangolás

**Files:**
- Modify: `src/app/template.tsx:12`

- [ ] **Step 1:** `transition={{ duration: 0.25, ease: 'easeOut' }}` → `transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}`. A transform-tilalom kommentje MARAD, transform továbbra sincs.

- [ ] **Step 2: Verify + Commit** — oldalváltás fade fluid; `git commit -m "feat: template fade fluid-gorbere hangolva"`

---

### Task 10: Főoldal — hero + szekció-reveal

**Files:**
- Modify: `src/components/home/HeroToday.tsx`, `src/components/home/SeasonGrid.tsx`, `src/components/home/WeekCalendar.tsx`, `src/components/home/FollowedRow.tsx`, `src/components/home/NextSeason.tsx`, `src/components/home/SocialFeed.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `fadeUp`, `staggerContainer`, `viewportOnce`, `tweenFluid` a `@/lib/motion`-ből.

- [ ] **Step 1: Szekció-reveal minta** — minden home-szekció gyökere:

```tsx
<motion.section variants={staggerContainer()} initial="hidden"
  whileInView="show" viewport={viewportOnce}>
  <motion.div variants={fadeUp}>{/* SectionHeader */}</motion.div>
  {items.map((it) => <motion.div key={it.id} variants={fadeUp}>…</motion.div>)}
</motion.section>
```

Kliens-komponenseknél közvetlenül; szerver-komponensnél a szekció-wrapper kerül kis client-komponensbe (`ui/Reveal.tsx` — lásd Step 2).

- [ ] **Step 2: `src/components/ui/Reveal.tsx` segéd** (create):

```tsx
'use client'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, staggerContainer, viewportOnce } from '@/lib/motion'

// Szerver-komponens gyerekeket reveal-lel beúsztató wrapper.
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp} initial="hidden"
      whileInView="show" viewport={viewportOnce}>
      {children}
    </motion.div>
  )
}

export function RevealGroup({ children, className, delay }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} variants={staggerContainer(delay)} initial="hidden"
      whileInView="show" viewport={viewportOnce}>
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 3: HeroToday** — a hero konténer `.glass-2` panel; belépés `fadeUp` 0-delay-jel (viewportban van, azonnal fut); a nagy cím `.text-silver` gradienst kap.

- [ ] **Step 4: Verify** — dev főoldal: szekciók görgetésre lépcsőzve úsznak be, hero üvegpanel + ezüst cím. Screenshot.

- [ ] **Step 5: Commit** — `git commit -m "feat: fooldal hero+szekcio-reveal a kozos motion-tokenekkel"`

---

### Task 11: Böngésző + lista + szűrők

**Files:**
- Modify: `src/app/bongeszo/page.tsx`, `src/app/lista/page.tsx`, `src/components/SeasonFilterBar.tsx`, `src/components/AddAnimeSearch.tsx`

**Interfaces:**
- Consumes: `Reveal/RevealGroup` (Task 10), `springFluid`; `.glass-lite` a rács-kártyákon (blur-budget!), `.glass-2` a szűrő-sávon.

- [ ] **Step 1: SeasonFilterBar** — a szűrő-pill-sor konténere `.glass-2 rounded-full p-1`; aktív pill `layoutId="season-filter"` úszó jelölő (Task 8 mintája szerint).

- [ ] **Step 2: Rács-reveal** — a bongeszo grid első oldalnyi kártyája `RevealGroup` + `fadeUp` stagger; a lapozással/szűréssel érkező új elemek NEM kapnak re-reveal-t (once). A rács-kártyák keretei `.glass-lite`.

- [ ] **Step 3: Verify** — dev bongeszo: szűrőváltásnál a jelölő úszik, kártyák staggerrel érkeznek; FPS oké nagy rácson (blur nincs a kártyákon!).

- [ ] **Step 4: Commit** — `git commit -m "feat: bongeszo+lista uveg-szurok, uszo jelolo, racs-reveal"`

---

### Task 12: Adatlap (CatalogTitlePage) + toplista

**Files:**
- Modify: `src/components/CatalogTitlePage.tsx`, `src/components/StreamLinks.tsx`, `src/components/toplista/Podium.tsx`, `src/components/toplista/LeaderboardRow.tsx`, `src/components/toplista/MetricValue.tsx`

**Interfaces:**
- Consumes: `Reveal/RevealGroup`, `fadeUp`, `staggerContainer`, `tweenFluid`; `.glass-2` az adatlap-paneleken.

- [ ] **Step 1: CatalogTitlePage belépés** — poszter-blokk + cím + meta-sorok `RevealGroup(0.09)`-ben lépcsőznek; az info-panelek (adatok, műfajok, StreamLinks) `.glass-2` felületre kerülnek. A meglévő PosterAmbient marad (ez a tartalom-fény).

- [ ] **Step 2: Toplista** — `Podium` három oszlopa staggerrel emelkedik be (`fadeUp` + `staggerContainer(0.12)`); `LeaderboardRow` sorok `RevealGroup`; `MetricValue` count-up:

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, animate } from 'framer-motion'
import { fluidEase } from '@/lib/motion'

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const mv = useMotionValue(0)
  useEffect(() => {
    if (!inView) return
    const ctrl = animate(mv, value, { duration: 1.2, ease: fluidEase,
      onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v) } })
    return () => ctrl.stop()
  }, [inView, value, mv, format])
  return <span ref={ref}>{format(0)}</span>
}
```

(A MetricValue meglévő formázó-logikája a `format` prop-on át jön; SSR-ben a végérték renderelendő, hogy a no-JS/SEO tartalom helyes legyen — a 0-ról indítás csak inView-nál induljon.)

- [ ] **Step 3: Verify** — dev: adatlap lépcsős belépés, toplista podium+sorok+számfutás. Screenshot mindkettőről.

- [ ] **Step 4: Commit** — `git commit -m "feat: adatlap+toplista reveal, uveg-panelek, count-up"`

---

### Task 13: Maradék oldalak seprése + graf-környezet

**Files:**
- Modify: `src/app/velemenyek/page.tsx`, `src/app/vs/page.tsx`, `src/app/stats/page.tsx`, `src/app/beallitasok/page.tsx`, `src/app/graf/page.tsx` (vagy ahol a Graph3D mountol), `src/components/HierarchyPanel.tsx`, `src/components/ui/Skeleton.tsx`, `src/components/ui/EmptyState.tsx`

**Interfaces:**
- Consumes: `Reveal/RevealGroup`, `.glass-1/2/lite`, `tweenFluid`.

- [ ] **Step 1: Oldal-seprés** — velemenyek/vs/stats/beallitasok: fő paneleik `.glass-2`, szekcióik `Reveal`; hosszú listák `.glass-lite`. A vs és wrapped meglévő framer-animációi a `@/lib/motion` tokenekre kötendők át (grep: `transition={{` ezekben a fájlokban — inline timingek cseréje `tweenFluid`/`springFluid`-ra).

- [ ] **Step 2: Graf** — a Graph3D-t befogadó konténer `motion.div` `initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={tweenFluid}` — a canvas KÖRÜLI belépés; a Graph3D belseje nem változik. HierarchyPanel `.glass-3` (modál-jellegű, budget-en belül).

- [ ] **Step 3: Skeleton shimmer** — a Skeleton kap `.glass-lite` alapot + meglévő pulse helyett/mellett shimmer:

```css
.skeleton-shimmer::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%);
  animation: shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
```

- [ ] **Step 4: Verify** — dev: mind a négy oldal + graf belépés + skeleton shimmer. `npx tsc --noEmit`.

- [ ] **Step 5: Commit** — `git commit -m "feat: maradek oldalak uveg-seprese, graf-belepes, skeleton-shimmer"`

---

### Task 14: Zöld akcent kivezetése + végső verifikáció

**Files:**
- Modify: `src/app/globals.css` + grep-találatok
- Verify: teljes app

- [ ] **Step 1: Mint-audit** — `grep -rn "7fd8ad\|status-watching\|mint\|emerald\|green" src/` — minden találat osztályozása: ADAT (státusz-dot, watching-jelzés kicsiben) → marad; UI-AKCENT (gomb, badge-szín, headline, link-szín, CTA) → semleges fehér/ezüstre cserélendő.

- [ ] **Step 2: Teljes teszt-kör**

Run: `npm test` — Expected: 455+ teszt PASS (a +N az új motion-teszt).
Run: `npx tsc --noEmit` — Expected: 0 hiba.
Run: `npm run build` — Expected: sikeres production build.

- [ ] **Step 3: Vizuális átvétel** — dev-szerver + Playwright-screenshotok: `/`, `/bongeszo`, adatlap, `/lista`, `/toplista`, `/graf`, `/velemenyek`, `/vs`, `/stats` — mindenhol: üveg-nyelv, ambient fény, nincs zöld UI-akcent, Inter mindenütt. Mobil-viewport (390px) screenshot a főoldalról és bongeszo-ról.

- [ ] **Step 4: Reduced-motion próba** — DevTools emulate `prefers-reduced-motion: reduce`: orbok állnak, reveal-ek instant, app teljesen használható.

- [ ] **Step 5: Commit** — `git commit -m "feat: mint-akcent kivezetese + teljes verifikacio (teszt+tsc+build+vizualis)"`

---

## Self-review jegyzet

- Spec-lefedés: 1→Task 1; üveg-skála/fény/specular/tokenek→Task 2-5; framer-architektúra→Task 3,6-13; komponens-tábla→Task 6-13; perf-budget→Task 2 (glass-lite), Task 11 (rács); zöld-kivezetés+elfogadási kritériumok→Task 14. Lighthouse-kritérium (spec 8. pont): Task 14 Step 3 alatt opcionálisan mérhető, nem blokkoló.
- A TonightPicker/RecommendMorph/WrappedStory átkötés (spec-tábla utolsó sora) Task 13 Step 1 grep-sepréséhez tartozik (inline timing → tokenek).
- Wrapped/vibe oldalak meglévő animációi működnek — Task 13 csak token-átkötést végez rajtuk, koreográfiát nem ír át.
