# UI-redesign: cover-driven kinematografikus arculat

Dátum: 2026-07-26
Ág: `feature/ui-redesign` (a `master`-ről)
Állapot: elfogadott terv, implementáció előtt

## 1. Miért

A logika és a backend készen van, a kinézet béta-szinten áll. A probléma nem az, hogy csúnya, hanem hogy **differenciálatlan**: minden oldal ugyanaz a séma (apró mono-címke + üveg-kártya + ötkolumnás rács). Négy mérhető oka van:

1. **Egy tipográfiai fokozat van.** Minden szekció-fejléc `label-mono` (11px, uppercase, `--text-3`), a `<h1>` 24px. A képernyő legnagyobb eleme a poszter, de a tipográfia nem támogatja, hanem elbújik mellette. Nincs display-fokozat.
2. **Egy felület van.** A `.glass` mindenen ott van: kártya, szekció-wrapper, badge, naptár, feed-sor. Ha minden emelkedik, semmi nem emelkedik.
3. **Nulla textúra.** Két radiális fehér gradiens 3,5-5%-on `#09090b` felett. Ez a „CSS-alapértelmezett dark" felület.
4. **Uniform mozgás.** Mindenhol `opacity 0→1`, `y 10→0`, `delay: i*0.03`. Ez nem ritmus, hanem tapéta.

## 2. Döntések

| Kérdés | Döntés |
|---|---|
| Art direction | **Cover-driven kinematografikus.** A borítók adják a színt; a shell monokróm marad. |
| Téma | **Dark-only.** A poszter-szín dark háttéren világít; világos módban a dinamikus poszter-szín kontraszt-korrekciót igényelne. |
| Scope | **Token-réteg + primitívek + shell + 4 kulcsoldal** (home, címoldal, `/bongeszo`, `/lista`). |
| i18n | Amit átírok, ott a hardkódolt szöveg `useTranslations`-ra megy — **kivéve** a `CatalogTitlePage` szerver-komponenst (lásd 6.2, ISR-korlát). A maradék ~30 tsx + 38 API-route külön kör. |
| Új brand-szín | **Nincs.** A szín a tartalomból jön. |
| Új dependency | **Nincs.** Tailwind v4 + framer-motion + `next/font/google` elég. |

### Miért nincs DB-migráció

A cover-driven irányhoz nem kell `coverColor` oszlop. A `titles` táblában ma `cover_url` és `banner_url` van (`src/db/schema.ts:56-57`), szín nincs. A poszter színét **a kép saját blur-kópiája** adja CSS-ből (`filter: blur() saturate()`), nem egy kinyert hex-érték. Így nulla migráció, nulla backfill, nulla kliens-oldali canvas-extrakció (ami az AniList CDN-nél CORS-kockázat is lenne).

## 3. Token-réteg (`src/app/globals.css` átírás)

### Tipográfia

`Instrument Serif` (display) + `Instrument Sans` (törzs, már használt) + `Geist Mono` (adat) + `Noto Sans JP` (kanji). Egy típus-család két vágása → koherens; a magas kontrasztú serif display filmplakát-hangot ad, ami pont a cover-driven irány.

```
--font-display: Instrument Serif    → h1/h2, hero, nagy számok
--font-sans:    Instrument Sans     → törzs, UI
--font-mono:    Geist Mono          → adat, eyebrow, countdown
--font-jp:      Noto Sans JP        → titleNative, kanji-akcentus
```

Fluid skála `clamp`-pel:

| Token | Érték |
|---|---|
| `--fs-display-xl` | `clamp(2.75rem, 6vw, 4.5rem)` |
| `--fs-display-l` | `clamp(2rem, 4vw, 3rem)` |
| `--fs-h2` | `1.5rem` |
| `--fs-body` | `0.875rem` |
| `--fs-eyebrow` | `0.6875rem` (mono, `0.14em` letter-spacing) |

A `label-mono` megmarad, de **lefokozva**: csak eyebrow-ként, a valódi szekció-cím fölé — nem helyette.

### Felület-skála

A `.glass` egy szintje helyett négy:

| Szint | Definíció | Használat |
|---|---|---|
| `surface-0` | nincs felület; whitespace választ | szekció-háttér (a mai wrapperek többsége ide megy) |
| `surface-1` | `rgba(255,255,255,.03)`, nincs blur, 1px hairline | listaelem, adat-blokk, naptár-cella |
| `surface-2` | a mai `.glass` | kártya, panel |
| `surface-3` | a mai `.glass-strong` + nagyobb árnyék | nav, modal, overlay, sticky szűrő-sáv |

Ma ~40 helyen van `glass rounded-3xl p-5` szekció-wrapper. A többség `surface-0`-ra kerül: whitespace választ, nem keret. Ez adja a hierarchia nagy részét.

### Textúra

- `--noise`: SVG `feTurbulence` data-URI overlay 2,5%-on, `body::after`, `pointer-events: none`.
- Vignetta: `radial-gradient` a szélekre, a mai két fehér ambient-gradiens helyére hangolva.

### Poszter-ambiens primitívek

```css
.poster-ambient  /* borító blur(64px) saturate(180%) scale(1.15) kópiája a tartalom alatt */
.poster-glow     /* hover: ugyanaz blur(20px)-en a kártya alatt → a poszter saját színe izzik */
```

A címoldalon ma csökevényes verzió van (`opacity-25 blur-2xl`, `CatalogTitlePage.tsx:59-65`). Ez lesz kiépítve és mindenhol használva: hero, kártya-hover, `/lista` sor-hover.

### Térköz, rádiusz, mozgás

- Térköz: 4px-alapú `--sp-1..12`. Ma ad-hoc (`p-2.5/3/4/5`, `gap-1.5/2/2.5/3/4`) — ez maga a béta-érzés.
- Rádiusz: `--r-sm .5rem` / `--r-md .875rem` / `--r-lg 1.25rem` / `--r-xl 1.75rem`.
- Easing: `--ease-out: cubic-bezier(.16,1,.3,1)`.
- Mozgás: három nevesített framer-motion preset `src/lib/motion.ts`-ben (`reveal`, `riseIn`, `posterHover`). A vak `delay: i*0.03` kikerül; helyette viewport-triggerelt reveal szekciónként, kártyán belül csak hover-mozgás.

### Szín

Nincs új brand-hue. A status-színek maradnak, hangolva: `--status-watching` hűvösebb zöld, `--status-dropped` tompább piros — hogy ne kiabáljanak a poszter-színek mellett.

## 4. Primitívek — új `src/components/ui/`

| Fájl | Felelősség | Mit vált le |
|---|---|---|
| `SectionHeader.tsx` | eyebrow + display-cím + jobb-oldali action-slot | ~18 helyen `<p className="label-mono mb-3">` |
| `Button.tsx` | `solid` / `ghost` / `outline`, `sm`/`md`, `loading` állapot | ~30 helyen kézi `btn-ghost border border-white/10 px-2.5 py-1 text-xs` |
| `Chip.tsx` | `data` (mono) / `genre` (outline) / `link` (nyíllal) | címoldal, böngésző, lista, vibe |
| `ScoreBadge.tsx` | fit-% és taste-score, **egy** színskála | 4 helyen inline másolat: `page.tsx:406-422`, `page.tsx:466-470`, `bongeszo/page.tsx:149`, `vs/page.tsx:291` |
| `PosterAmbient.tsx` | blur-kópia backdrop, `intensity: 'hero' \| 'card' \| 'row'` | ma csak a címoldalon |
| `Skeleton.tsx` | poszter / sor / szöveg váz | **nincs** — ma villogó „Adások betöltése…" mono-szöveg |
| `EmptyState.tsx` | eyebrow + cím + magyarázat + CTA | ma csupasz `<p>` („Nincs találat a szűrőkre.") |
| `PageShell.tsx` | konténer-szélesség + padding egy helyen, `width` prop | ma 17 oldal külön írja (`max-w-4xl`/`max-w-5xl`, `pt-24`/`pt-28`) |

Minden primitív egy dolgot csinál, props-on keresztül kommunikál, és önállóan érthető. A `ui/` mappa nem importál oldal-specifikus kódot.

### `MediaCard` átírás

A legnagyobb egyszeri hatás: mind a 4 oldal fő eleme.

- **A kártya-keret eltűnik** (`glass` → `surface-0`). A poszter maga a kártya, a szöveg alatta a háttéren áll. Filmplakát-ritmus, nem adatrács.
- Poszter: `aspect-[2/3]`, `--r-md`, hairline belső keret (`inset 0 0 0 1px rgba(255,255,255,.08)`), alul beépített gradiens-lábazat a badge olvashatóságához.
- Hover: `poster-glow` + `scale(1.02)` + a leírás **becsúszik**. Ma a leírás mindig ott van 3 sorban (`MediaCard.tsx:48`) → ez tömi tele a rácsot és eszi a hierarchiát.
- Cím: `font-sans` 15px medium. Műfaj: mono 10px `--text-3`, **max 2** (ma 3, tördel).
- `variant: 'poster' | 'row'`. A `row` vízszintes, 32×44 thumb — `/lista`, feed, watchlist.

## 5. Shell

### TopNav

Ma 9 tab + locale + settings egy pillben, `overflow-x-auto`, `max-w-[95vw]`. Mobilon vízszintesen kell húzni.

- **Elsődleges 5**: Kezdőlap · Gráf · Lista · Böngésző · Vélemények (pending-badge marad)
- **`Több ▾` menü**: Toplista · Vibe · Stats · VS · Wrapped — a `Wrapped` **új nav-bejegyzés** (ma a `/wrapped` oldal létezik, de nincs a `TABS`-ban, `TopNav.tsx:8-18`)
- **Jobb oldal**: kereső-ikon → `/bongeszo?focus=1`; a böngésző a `focus` query-param hatására fókuszálja a meglévő kereső-inputot. **Nem** új ⌘K-paletta, nem új kereső-UI. Utána `LocaleSwitcher` · avatar → beállítások
- **Wordmark**: display-serif „Anime Graph" + inline SVG mark (3 pont + 2 él, a gráf-identitásból). Nincs asset-fájl.
- **Mobil (`<md`)**: a felső pill eltűnik, **alsó tab-bar** 4 elsődleges + `Több`, safe-area paddinggel. Ma teljesen hiányzik; ez a legnagyobb mobil-nyereség.
- Scroll-állapot: a lap tetején áttetszőbb, lefelé scrollnál `surface-3`-ra sűrűsödik.

### `layout.tsx`

Display-font regisztrálása, `body::after` noise + vignetta, `PageShell` bevezetése.

## 6. A négy oldal

### 6.1 Home (`src/app/page.tsx`, 530 sor)

Ma 8 egyenrangú szekció, és a **sorrend is rossz**: a „Társaság" feed a második blokk, mások aktivitása előbb, mint amit a user követ.

**Új sorrend:** Hero („Ma") → Amit követsz (row) → Heti naptár → A szezon (a fő rács) → Következő szezon → Társaság.

- **Hero-sáv (új)**: full-bleed `PosterAmbient intensity="hero"`, `display-xl` cím, nagy countdown, a digest-mondat alatta. Ez adja a lap arcát.

  Melyik címet mutatja — **explicit fallback-lánc, első találat nyer**:
  1. `data.mine` közül a legkisebb jövőbeli `airingAt`-ú (a legközelebb adásba kerülő követett cím) → countdown-nal
  2. ha nincs jövőbeli adás, de van `mine`: a `status === 'watching'` közül a legnagyobb `progress`-ű → countdown helyett „x/y rész" + `+1` gomb
  3. ha `mine` üres: a `visibleSeason` legnagyobb fit-pontszámú eleme → `+ Tervezem` gombbal, alatta a meglévő `OnboardingCTA`
  4. ha a szezon-adat is üres (hiba vagy betöltés): `Skeleton` hero, majd `EmptyState` — a hero soha nem tűnik el layout-ugrással
- „Következő szezon" ma **két** szekció („neked" + „teljes kínálat") → **egy** szekció `neked / mind` togglelel.
- **Fájl-szétvágás** (előfeltétel, nem kozmetika): 530 soros kliens-komponens 7 fetch-csel nem szerkeszthető megbízhatóan. Szét: `HeroToday` · `FollowedRow` · `WeekCalendar` · `SeasonGrid` · `NextSeason` · `SocialFeed` — mindegyik a saját fetch-ét birtokolja, a `page.tsx` csak komponál. A `TourSpotlight` és a `NEWS_TOUR` léptetői a `data-tour` szelektorokkal együtt mozognak a megfelelő komponensbe.

### 6.2 Címoldal (`src/components/CatalogTitlePage.tsx`, 208 sor)

- **Kinematografikus hero**: full-bleed banner `PosterAmbient intensity="hero"`, letterbox-gradiens, borító 200px valódi árnyékkal, cím `display-xl`, `titleNative` Noto JP-vel alatta, chipek egy mono-sorban.
- **A fit-badge felkerül a heróba.** Ma külön kártya a hero alatt (`CatalogTitlePage.tsx:111`) — a legfontosabb információ a leggyengébb pozícióban.
- A 6 db `glass rounded-3xl p-5` szekció → `surface-0` + `SectionHeader` + whitespace.
- Leírás: `max-w-[62ch]`, nagyobb sortáv. Ma teljes szélességben fut → 120+ karakteres sorok.
- Stáb / karakterek: vízszintes snap-scroll sáv a `flex-wrap` helyett.
- Kapcsolódó: `row`-variant `MediaCard` a csupasz AniList-link-lista helyett.

**ISR-korlát (kötelező betartani).** Ez szerver-komponens ISR-cache-ben. Nem kerülhet bele dinamikus API: se `no-store` fetch, se `getTranslations`. Ez volt a 2026-07-25-i P0, ami minden címoldalt 500-azott, és **`next dev`-ben nem reprodukálódik**. A személyre szabott rész marad az `OwnerOverlay` / `FitBadge` kliens-határon.

**Következmény:** a címoldal szekció-címkéi statikus szövegek maradnak; i18n itt csak a kliens-komponensekben történik. Ez tudatos, a meglévő kliens-oldali locale-döntéssel konzisztens korlát.

### 6.3 `/bongeszo`

- Sticky szűrő-sáv `surface-3`-ban; az aktív szűrők chipként (`Chip variant="link"`) + „töröl mind".
- Sűrűbb rács: 6 kolumna `2xl`-en (ma max 5 `xl`-en).
- `Skeleton` poszter-vázak a három betöltési ág mindegyikére (ma három helyen ugyanaz a villogó „Betöltés…" `<motion.p>`: `bongeszo/page.tsx:254-257`, `294-297`).
- `EmptyState` a négy üres-ág mindegyikére (ma csupasz `<p>`: „Írj be egy címet…", „Nincs találat a katalógusban.", „Nincs találat ezzel a szűrővel.", „Még kevés bejelentett cím…").
- **A lapozás marad lapozás.** A `prev/next` gomb-pár (`page` state + `PAGE_SIZE = 24` offset) megmarad, csak `Button`-primitívre cserélve és lapszám-kontextussal. Végtelen-scroll **nincs** bevezetve — az funkció-változás lenne, nem redesign.
- Új: a `?focus=1` query-param a meglévő kereső-inputot fókuszálja (a nav kereső-ikonjához).

### 6.4 `/lista`

Ez a napi munkalap → itt a **sűrűség** a design, nem a levegő.

**A `<table>` marad táblázat.** Ma rendezhető fejléc-oszlopokkal működik (`sortBy`, `sortKey`, `sortDir` — `lista/page.tsx:83-86, 122-128`); kártya-rácsra vagy status-szerinti csoportosításra cserélve elveszne a rendezhetőség. Ez regresszió lenne, nem redesign. Ami változik:

- A tábla-wrapper `glass rounded-3xl` → `surface-1`, hairline sor-elválasztókkal.
- Sticky `<thead>` a hosszú listához (ma elscrollozik).
- Sor-hover: `poster-glow` a sor bal szélén a borító színéből (nem a mai sík `hover:bg-white/4`).
- Új oszlop: vékony progress-sáv (`progress`/`episodes`) — ma a haladás csak a detail-oldalon látszik.
- Új: egykattintásos `+1` a soron. Ma ehhez meg kell nyitni a detail-oldalt.
- `EmptyState` a „Nincs találat." helyére (a `list.length === 0` ág marad `OnboardingCTA compact`).

## 7. Adatfolyam, hibakezelés

Az adatfolyam nem változik: ugyanazok az API-végpontok, ugyanazok a fetch-ek — csak más komponensben élnek. A meglévő „enélkül is él az oldal" `.catch()`-minta megmarad, de a néma `catch` helyett a szekció `EmptyState`-et vagy `Skeleton`-t mutat, ahol a user különben üres helyet látna. Az egyetlen adat-szintű változás a home-on: minden szekció a saját fetch-ét birtokolja, így egy hibás végpont csak a saját szekcióját érinti (ma a `/api/news` hibája az egész lapot hibaképernyőre viszi, `page.tsx:177-186`).

## 8. Tesztelés, ellenőrzés

Sorban mind a négy, kihagyás nélkül:

1. `npx tsc --noEmit` — 0 hiba
2. `npm test` — a teljes teszt-készlet zöld. A baseline-darabszámot az implementáció **első** lépése rögzíti (`npm test` a `master`-en, még kódváltozás előtt), és a végén ugyanannyi vagy több tesztnek kell zöldnek lennie.

   **Fontos a teszt-környezetről:** a `vitest.config.ts` `environment: 'node'` és `include: ['src/**/*.test.ts']` — kizárólag `.ts`, nem `.tsx`. A 60+ teszt mind **tiszta lib-logika** (`src/lib/*.test.ts`); komponens-teszt, jsdom és React Testing Library **nincs** a projektben. Két következmény:
   - A vizuális átírás önmagában nem tud tesztet elrontani (nincs class-névre hivatkozó teszt) — de nem is tud tesztet nyújtani. A vizuális ellenőrzés a 4. pont (screenshot), nem a 2.
   - Ezért ahol a redesign **döntési logikát** hoz (hero fallback-lánc, ScoreBadge színskála, nav-csoportosítás, PageShell szélességek), az a logika **`src/lib/`-be kerül tiszta függvényként és TDD-vel készül**. Nem a komponensbe ágyazva. Ez a terv gerince.
3. `npm run build && npm start` — **nem** csak `next dev`. A címoldal ISR-500-a dev-ben nem jön elő; a prod-build az egyetlen kapu.
4. Playwright-screenshot a 4 oldalról 390px és 1440px szélességen, és a képek **tényleges megtekintése**, mielőtt bármi késznek minősül.

Új teszt kell: a `ScoreBadge` színskálájára (egy helyen dől el, 4 helyett) és a `PageShell` szélesség-variánsaira.

## 9. Scope-on kívül

Kimondva, hogy ne legyen félreértés:

- **A maradék 13 oldal** (`graf`, `vibe`, `wrapped`, `stats`, `vs`, `toplista`, `velemenyek`, `u/[username]`, `p/[token]`, `onboarding`, `login`, `beallitasok`, `anime/preview`) a token- és primitív-csere miatt **változni fog** és jobb lesz, de nem kap egyedi layout-átírást. Ha valamelyik így elcsúszik, javítom — de nem tervezem újra.
- **i18n**: a maradék ~30 tsx + 38 API-route.
- **`stash@{0}`** (liquid-glass home WIP, visszavonva 2026-07-23) nem kerül vissza.
- **Push és Vercel-deploy**: a useren, ahogy eddig.
