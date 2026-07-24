# Feature-batch 2 — design

*2026-07-24 · 13 tétel: bugfixek + UX-csiszolás + új oldalak (vélemény-váró, toplista, next season) + wrapped-slideshow*

## Cél

A user által kért 13 javítás/bővítés egy batchben. Publikus-versenytárs irányt erősíti
(katalógus-oldalak gazdagabbak, toplista, üres-állapotok), plusz a személyes élményt
csiszolja (wrapped, vibe, kitűzés, gráf-zoom).

## Döntések (user-jóváhagyott)

- **Leaderboard**: mind a 3 fül (házon belüli communityScore, AniList avgScore,
  nálunk-népszerűség) + műfaj-szűrő minden fülön.
- **Vibe**: több chip-csoport (nem AI-visszakérdezés).
- **Wrapped**: story-slideshow irány; kép-export NEM része ennek a körnek.
- **Adatmentés (export)**: teljesen törlendő (UI-szekció + `/api/export` route).

## Tételek

### 1. Vélemény-váró oldal — `/velemenyek`

- Új oldal: a bejelentkezett user saját címei, amelyekhez **nincs opinion-sor**, vagy
  `extract_status = 'failed'`.
- Rendezés: `completed` elöl (myScore desc, aztán frissesség), utána `watching`,
  `dropped`; `planned` NEM jelenik meg (arról nincs mit véleményezni).
- Kártya: borító + cím + státusz + saját pont + **inline textarea** és Mentés gomb —
  a mentés a meglévő `/api/opinion` végpontra megy, siker után a kártya kikerül a
  listából (optimista UI).
- TopNav: darabszám-badge a menüponton (a lista-lekérés adja a countot; nincs külön
  polling, oldalbetöltésenként frissül).
- Új lib: `opinion-queue.ts` (szűrés+rendezés tiszta függvényként, tesztelve).

### 2. Gráf: zoom a kurzorhoz

- Elsődleges: `controls.zoomToCursor = true` a `Graph3D` init-jében (three r149+
  OrbitControls natív feature; a react-force-graph-3d `controls()`-on át érhető el).
- Implementációkor ellenőrizni a bundled three verziót; ha < r149, fallback:
  wheel-handler, amely a kurzor NDC-koordinátája felé tolja a kamerát zoom közben
  (raycast nélkül is elég az irányvektor).
- A meglévő első-betöltés `zoomToFit` és drill-down kamera-repülések változatlanok.

### 3. Címoldal-bővítés (`CatalogTitlePage`)

- **Karakter-kártya**: karakter-kép MELLETT a seiyuu (VA) kép + név is (kétosztatú
  kártya). Adat már jön a `/api/characters/[anilistId]`-ből; ha a VA-kép még nincs a
  payloadban, a query bővül.
- **Stáb-szekció**: rendező + főbb stáb (max ~6) AniList staff-queryből, `api_cache`
  TTL-lel (pl. 7 nap) — nem élő hívás minden requestre, és ISR alatt is determinisztikus.
- **Stúdió**: kattintható link → `/bongeszo?studio=<név>` (a böngésző kap stúdió-szűrő
  querystring-támogatást).
- **Eredeti manga kiemelése**: a `title.relations`-ből a `SOURCE` (ill. `ADAPTATION`
  a manga-oldalakon) típus külön kártya: borító + cím + link. Link-cél: ha a cím
  megvan a lokális katalógusban → `/manga/[slug]` (slug-resolver), különben
  `/anime/preview/[anilistId]`-analóg preview. A relations-lista többi eleme marad a
  mostani formában.
- A relations-ben csak anilistId+title van (borító nincs) → a SOURCE-kártya borítóját
  a lokális title-táblából olvassuk (join anilistId-ra); ha nincs meg, kártya borító
  nélkül.

### 4. Katalógus-keresés üres állapota

- A `/bongeszo` (és a kereső-modal, ha külön van) query nélkül nem üres:
  - **„Felkapott most"**: aktuális szezon címei avgScore desc, limit 12;
  - **„Nálunk népszerű"**: popularity desc (min. 1), limit 12.
- Tisztán lokális DB-query, külső hívás nélkül; `browse-local` bővítés vagy kis új
  helper (`trending.ts`), tesztelve.

### 5. Toplista — `/toplista`

- Fülek:
  1. **Házon belüli**: `communityScore` desc, `communityCount >= 2` küszöbbel;
  2. **AniList**: `avgScore` desc (a teljes 32k katalóguson, avgScore not null);
  3. **Legnézettebb nálunk**: `popularity` desc, `popularity >= 1`.
- Minden fülön: **műfaj-szűrő** chipsor (a title.genres-ből) + **anime/manga váltó**.
- Megjelenés: helyezés-szám, borító, cím, pont/darabszám, top 50, lapozás nélkül
  (egyszerű limit).
- ISR (pl. 1 óra revalidate) — publikus oldal, session nem kell; a whitelist-audit
  szerinti publikus route-listára felkerül.
- Új lib: `leaderboard.ts` (query-builderek + küszöb-logika, tesztelve).

### 6. Vibe-bővítés

- Új chip-csoportok a `vibe-presets.ts`-ben (a meglévő formátumban):
  - **Helyszín**: iskola, fantasy-világ, űr, történelmi, nagyváros;
  - **Témák**: bosszú, sport, zene, pszichológiai, mecha, isekai, időutazás,
    harcművészet;
  - **Célközönség**: shounen, seinen, shoujo, josei;
  - **Forrás**: manga-adaptáció, light novel, eredeti anime, játék-adaptáció.
- Prompt-összefűzés és a `/api/vibe` flow változatlan; preset-teszt bővül.

### 7. TasteCard layout-fix

- Bug: a kártya elcsúszik, a képek a statokra lógnak (stats-oldal, `TasteCard.tsx`).
- Javítás implementációkor diagnosztizálva (várhatóan absolute/grid ütközés vagy
  hiányzó overflow/gap); vizuális ellenőrzés dev-serveren.

### 8. Wrapped → story-slideshow

- `/wrapped` új formája: teljes képernyős, slide-onként animált story:
  - progress-sáv felül (slide-onként szegmentálva),
  - lapozás: kattintás/tap (jobb = következő, bal = előző) + nyílbillentyűk,
  - slide-ok: intro → össz-epizód+óra → top műfajok → top stúdiók → top animék →
    leghosszabb streak → kedvenc karakterek → **új: drop-ok** → **új: binge-rekord
    (egy napon legtöbb epizód)** → manga → záró összefoglaló-kártya.
- Animáció: CSS/inline-transition (nincs új dependency, framer-motion NEM kerül be).
- A `buildWrapped` bővül a 2 új stattal (dropok száma, max epizód/nap az
  episode_log-ból), tesztelve.
- Kép-export/megosztás: KÉSŐBBI kör.

### 9. Klub-ajánló UX (`/vs`)

- „Hogyan működik?" collapsible a lap tetején: átlag 60% + minimum 40%, vétó fit<35,
  min. 2 ismert tag — közérthetően megfogalmazva.
- Minden pick alatt **tagonkénti fit-sávok** (név + 0–100 sáv; a `perMember` adat már
  jön az API-ból), a vétó-közeli (<45) sáv vizuálisan jelölve.
- Logika (`group-pick.ts`) NEM változik.

### 10. Publikus lista rendezés (`/p/[token]`)

- Kliens-oldali vezérlők: rendezés **pontszám ↓** (default marad a mostani), **cím
  A–Z**, **év ↓**; státusz-szűrő chipek (all/completed/watching/dropped/planned).
- Adat már a kliensen van (`PublicAnime`: title, coverUrl, status, myScore, year) —
  API nem változik ehhez a tételhez.

### 11. Adatmentés törlése

- Beállítások „Adatmentés" szekció ki; `/api/export` route + `export`-hoz tartozó
  lib/teszt törlés; publikus/privát route-listákból kivezetni.

### 12. Kitűzés a profilra

- `settings` jsonb-kulcsok (nincs sémamódosítás):
  - `pinnedTitles`: max 3 `titleId`;
  - `pinnedChars`: max 3 `charId` (csak a saját `favorite_characters`-ből).
- UI: kitűzés-gomb a lista-kártyán és a címoldali `OwnerOverlay`-en (toggle, 4.
  kitűzésnél a legrégebbi kiesik VAGY hibaüzenet — döntés: **hibaüzenet**, explicit
  csere a usernél); karakter-kitűzés a kedvenc-karakter rácsról.
- Megjelenés: `/p/[token]` hero-sáv (kitűzött animék borítói + kitűzött karakterek),
  saját `stats` oldal tetején ugyanez.
- Publikus whitelist bővítés: a kitűzött címek (cím+borító+slug) és karakterek
  (név+kép) mehetnek ki; vélemény/ízlés-adat továbbra SEM.
- Új lib: `pins.ts` (validáció: max 3, létező kedvenc/saját cím; tesztelve).

### 13. Következő szezon (upcoming)

- News-oldal új szekciója: **„Következő szezon"** — `nextSeason()` (megvan a
  `seasonal.ts`-ben) + lokális katalógus `season`+`year` szűrés, borító+cím+formátum
  + **fit-badge** (meglévő batch-fit endpoint).
- Böngésző: szezon-választó bővül „következő szezon" opcióval (querystring-paraméter,
  a 3. tétel stúdió-szűrőjével közös munkába).
- Megkötés: a next-season címek csak akkor teljesek, ha a katalógus-sync már felvette
  őket — a szekció üres-állapota erre utal („még kevés bejelentett cím").

## Nem-célok

- Wrapped kép-export/megosztás.
- Klub-ajánló logika-változtatás.
- AI-visszakérdezés a vibe-ban.
- Bármi a D3 élő OAuth-teszthez vagy a deployhoz.

## Sorrend

1. Bugfixek: **2** (gráf-zoom), **7** (TasteCard).
2. Kis UX: **4** (üres állapot), **9** (klub UX), **10** (publikus rendezés),
   **11** (export-törlés).
3. Új oldalak: **1** (vélemények), **5** (toplista), **13** (next season).
4. Tartalom: **3** (címoldal), **6** (vibe), **12** (kitűzés).
5. **8** (wrapped) a végén — legnagyobb felület.

## Tesztelés

- Minden új lib tiszta függvényként, vitest DB/hálózat nélkül: `opinion-queue`,
  `trending`, `leaderboard`, `pins`, `buildWrapped`-bővítés, vibe-preset bővítés.
- `tsc` + `npm run test` + `npm run build` zöld a batch végén; vizuális tételek
  (7, 8, gráf-zoom) dev-serveren ellenőrizve.
