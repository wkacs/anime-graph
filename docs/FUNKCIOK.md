# Anime Graph — Teljes funkciólista

*Állapot: 2026-07-24 este (feature-batch-2 után, 272 teszt zöld, build zöld)*

Az Anime Graph egy személyes 3D anime-térképből indult, mára egy **publikus, több­felhasználós anime/manga-katalógus és AI-alapú ízléskövető platform** (MAL-versenytárs irány, freemium modellel tervezve). Ez a dokumentum összefoglalja, hogy **most** mit tud az alkalmazás.

---

## 1. Oldalak (route-térkép)

| Útvonal | Mit csinál |
|---|---|
| `/` | Kezdőlap / hírek (News) |
| `/graf` | 3D anime-gráf (a névadó funkció; zoom a kurzor felé) |
| `/bongeszo` | Katalógus-böngésző (lokális DB, „Felkapott most" üres állapot, stúdió- és szezon-szűrő) |
| `/lista` | Saját lista (státuszok, értékelések, 📌 kitűzés) |
| `/velemenyek` | Vélemény-váró címek, kártyán belüli vélemény-írással (TopNav-badge számlálóval) |
| `/toplista` | Publikus leaderboard: Nálunk / AniList / Legnézettebb fülek + műfaj-szűrő |
| `/anime/[slug]`, `/manga/[slug]` | Kanonikus, publikus címoldalak (ISR + SEO) |
| `/anime/preview/[anilistId]` | Előnézet még fel nem vett címekhez, hozzáadás-gombokkal |
| `/stats` | Statisztikák (heatmap, idővonal, összehasonlítás) |
| `/vibe` | Hangulat-alapú keresés/ajánlás (vibe-presetekkel) |
| `/vs` | Klub-ajánló: több felhasználónak közös ajánlat (group-pick) |
| `/wrapped` | Éves „Wrapped" összefoglaló |
| `/p/[token]` | Publikus, megosztható profil (token-alapú) + kompatibilitás-chip |
| `/onboarding` | Új felhasználói wizard (lásd 9. pont) |
| `/beallitasok` | Beállítások (push, szinkron-fiókok, export stb.) |
| `/login` | Belépés / regisztráció (meghívó-kódos) |

---

## 2. 3D gráf (az eredeti mag)

- Hierarchikus 3D térkép: **műfaj → stúdió → anime**, kapcsolható szintekkel (`graph-builder`).
- `react-force-graph-3d` + bloom effekt (`Graph3D`), oldalpanel (`SidePanel`), hierarchia-panel.
- Rendező-réteg: stáb/rendező szerinti kapcsolatok is megjelennek (staff-backfill adatokból).

## 3. Katalógus (M1–M2, teljes)

- **Központi katalógus-séma** (M1 katalógus-split): `title` + `user_title` szétválasztva — a cím-adat közös, a felhasználói adat (státusz, pontszám, vélemény) per-user.
- **Teljes AniList-szinkron lefutott**: ~**21 900 anime** + **108 000+ manga**, összesen **~32k+ title** a dev DB-ben, 0 orphan. Szinkron-script (`sync-catalog.mjs`) évek/hónapok szerinti szeleteléssel kerüli az AniList 5000-es lapozási plafonját.
- **Offline-DB import** (`import-offline-db.mjs`): szelektív upsert a title-táblába, GitHub-Release-assetről.
- **Kanonikus publikus oldalak** (M2b): `/anime/[slug]` és `/manga/[slug]` — ISR-shell (`CatalogTitlePage`) + kliens­oldali `OwnerOverlay` (a saját adat csak kliensen töltődik → nincs cache-szivárgás). Slug-resolver + legacy `/anime/[id]` numerikus 301-redirect.
- Címoldal-tartalom: leírás, karakter-rács **seiyuu-képpel/névvel** (`CharacterGrid`), **stáb-szekció** (rendező, alkotó, karakterdizájn stb., 7 napos `api_cache`-sel), **kattintható stúdió-chip** (→ böngésző stúdió-szűrő), **„Eredeti mű"/„Anime-adaptáció" kártya** (a relations SOURCE/ADAPTATION eleme borítóval, lokális kanonikus linkkel), **openingek/endingek lejátszó** (`ThemesPlayer`), **streaming-linkek** (`StreamLinks`), közösségi pontszám.
- **Keresés** (M2a): Postgres `tsvector` + GIN-index, `/api/search`; a böngésző és a hozzáadás-flow is a lokális katalógusból keres (AniList-fallbackkel, hozzáadás titleId alapján).
- **SEO** (M2c): `robots.ts`, sitemap-index 45k-s chunkokkal, JSON-LD (XSS-safe `<`-escape-pel), OpenGraph + `generateMetadata` minden címoldalon.

## 4. Saját lista és vélemények

- Státuszkövetés, értékelés, saját lista (`/lista`), törölt elem visszaállítása (`/api/anime/restore`).
- **Vélemény minden animéhez** (`/api/opinion`): mentéskor a GLM 3–8 rövid **ízlés-tényt** nyer ki → `taste_memory` tábla (a nyers szöveg is megmarad).
- Kedvenc karakterek jelölése (`/api/characters/favorite`).

## 5. AI-ízlésmotor és ajánlók

- **Recommend me**: legjobbra értékelt animék ajánlás-poolja (ma már **lokális rec-pool**, nem élő AniList) → tag-átfedéses rangsor (`candidates`/`local-candidates`) → GLM újrarangsorol a teljes ízlés-memória alapján, személyes indoklással.
- **Fit-score (D1)**: minden címre 0–100 illeszkedés a saját ízléshez; `FitBadge` a böngészőben, szezon-gridben, címoldalakon; batch-endpoint (`/api/fit/batch`).
- **Drop-rizikó (D7)**: a fit-motor becsüli, mekkora eséllyel dobnád el a címet.
- **Ízlés-evolúció**: hogyan változott az ízlésed időben (`evolution`, `taste/eras` — ízlés-korszakok), **ízlés-DNS kártya** (`TasteCard`).
- **Vibe-keresés** (`/vibe`): hangulat-presetek + szabad szöveg → ajánlat; 9 chip-csoport (hangulat, műfaj, hossz, korszak, tempó + **helyszín, témák, célközönség, forrás**).
- **Természetes nyelvű keresés** (`/api/search/nl`): „valami rövid, sötét thriller a 2010-es évekből" jellegű lekérdezések.
- **Tonight-picker** (`TonightPicker`): „ma este mit nézzek" gyorsválasztó.
- **Szezon-AI**: az aktuális szezon címeinek AI-pontozása az ízlésedre (`/api/news/season-scores`).
- **Duo-ajánló** (`/api/recommend/duo`): két felhasználó közös ízlésére ajánl.
- **Klub-ajánló (D5, `/vs`)**: több fős csoportnak közös pick (`group-pick`).

## 5/b. Toplista és vélemény-váró (feature-batch-2)

- **/toplista** (publikus): három fül — házon belüli communityScore (min. 2 értékelés), AniList avgScore (32k címen), „Legnézettebb nálunk" (popularity) — műfaj-chipsorral és anime/manga váltóval, top 50, 1 órás cache.
- **/velemenyek**: minden saját cím, amihez nincs (sikeres) vélemény; completed→watching→dropped sorrend, kártyán belüli textarea + mentés a meglévő opinion-flow-ba; TopNav-badge mutatja a darabszámot.
- **Böngésző üres állapota**: keresés nélkül „Felkapott most" (aktuális szezon top AniList-pontszám) + „Nálunk népszerű" rácsok, tisztán lokális DB-ből.

## 6. Social / több felhasználó

- **Multi-tenant**: meghívó-kódos regisztráció (felhasználónév + jelszó), session-alapú auth; az első regisztrált fiók örökli a multi-tenant előtti adatokat.
- **Feed**: a többiek aktivitása (`/api/feed`).
- **Személyes watchlist** (`/api/watchlist`); a közös lista külön, szerepkörös csoportmodellben jön majd.
- **Kompatibilitás-% (D4)**: két felhasználó ízlés-egyezése, `CompatChip` a publikus profilon.
- **Publikus profil** (`/p/[token]`): token-alapú, megosztható nézet; **rendezés** (pont/cím/év) + **státusz-szűrő** chipek; **kitűzött kedvencek hero-sávja**.
- **Kitűzés**: max 3 kedvenc cím (lista 📌-oszlop, címoldali overlay-gomb) + max 3 kedvenc karakter (karakter-rács 📌) — a publikus profilon és a stats tetején jelenik meg; szigorú whitelist (vélemény-adat nem megy ki).
- **Klub-ajánló UX**: „Hogyan működik?" magyarázó + tagonkénti fit-sávok, vétó-közeli érték jelölve.
- **Összehasonlítás** (`/api/compare`): listák/ízlések egymás mellett.

## 7. Hírek, szezon, értesítések

- **News-oldal** (`/`): felkapott/szezonális hírek, cache-elve; upcoming-lista visszaszámlálóval (`Countdown`); **„Következő szezon — teljes kínálat"** rács a lokális katalógusból fit-badge-ekkel + link a böngésző next-season szűrőjére.
- **Szezon-szűrősáv** (`SeasonFilterBar`) + szezon-grid fit-badge-ekkel.
- **Web push értesítések** (`PushToggle`, `/api/push`): epizód-megjelenés (airing-check cron), **szezonváltás-értesítés** a napi cronban.
- **Cron-jobok** (GitHub Actions ütemezéssel): `airing-check` (napi), `time-capsule`.
- **Időkapszula (D8)**: „egy éve ilyenkor néztem/mondtam" visszatekintő cron.

## 8. Import / export / külső szinkron

- **MAL-import** (`/api/import/mal`) és **AniList-import** (`/api/import/anilist`) — teljes lista áthozása, upsert-tel.
- **Kétirányú MAL/AniList-szinkron (D3)**: OAuth-flow (`/api/sync/[provider]/start` + `callback`), `sync_accounts` tábla, visszaírás (`sync-back`) és státusz-lekérdezés. ⚠️ *OAuth-app-regisztráció + env-kulcsok kellenek hozzá, élő API ellen még nem tesztelt.*
- **Adat-export**: letölthető JSON a teljes személyes adatkészletről; jelszó- és OAuth-tokenek nélkül.
- **Fióktörlés**: jelszó + `DELETE` megerősítés után tranzakciósan törli a személyes adatokat és kijelentkeztet.

## 9. Onboarding és túra

- **`/onboarding` wizard**: import (MAL/AniList) **vagy** AniList top-24-ből seed-kiválasztó; skip-megerősítő; **profil-reveal** (azonnali ízlésprofil a kiválasztottakból); push-engedély kérés.
- **TourSpotlight**: oldalankénti spotlight-túra (news, gráf, böngésző, címoldal) `data-tour` célpontokkal.
- **OnboardingCTA**: kontextusfüggő továbbvezető kártyák a fő oldalakon.

## 10. Wrapped és statisztikák

- **/wrapped**: éves összefoglaló — **teljes képernyős story-mód** (progress-sáv, kattintás/nyíl-lapozás, animált slide-ok, záró összefoglaló-kártya) + görgetős fallback; új statok: **binge-rekord** (legtöbb epizód egy nap) és **dropok**.
- **/stats**: heatmap (nézési aktivitás), idővonal, összesítők.

## 11. Backend-hardening / üzemeltetés

- **Réteges AI-kvóta**: tier-alapú napi limit + `ai_usage_log` + költség-naplózás (`ai-cost`); GLM (`glm-4.7-flash`) + OpenRouter failover.
- **Auth rate-limit**: élőben igazolva (10×401 → 429).
- **Publikus endpoint-whitelist audit**: csak a szándékosan publikus route-ok érhetők el session nélkül.
- **Lokális működés**: rec-pool, browse és keresés a saját DB-ből megy (nem élő AniList-hívásokból) → gyorsabb, kvóta-barát.
- **API-cache** + News-cache; ISR-500 bug (no-store × revalidate ütközés) megfogva és javítva (`7789eaf`).
- Idempotens migrációs scriptek a `scripts/` alatt (catalog-split, search-vector, sync-accounts, ai-tier stb.).

## 12. Technikai stack

- **Next.js** (App Router, ISR) + **Neon Postgres** + **Drizzle ORM**; Vercel-re szánva.
- AI: GLM `glm-4.7-flash` (ingyenes tier) + OpenRouter failover.
- Tesztek: **272 vitest unit** (DB/hálózat nélkül futnak) + `tsc` + build zöld.
- Env: `DATABASE_URL`, `GLM_API_KEY`, `SESSION_SECRET`, `INVITE_CODE`, opcionális `AI_DAILY_LIMIT`, `OPENROUTER_API_KEY`, push-hoz VAPID-kulcsok, cronhoz `CRON_SECRET`/`APP_URL`.

---

## 12/b. Kapunyitás (Gate A, 2026-07-26)

Spec: `docs/superpowers/specs/2026-07-26-gate-a-kapunyitas-design.md`,
terv: `docs/superpowers/plans/2026-07-26-gate-a-kapunyitas.md`.

- **Nyílt regisztráció**: e-mail + felhasználónév + jelszó (min. 8 karakter), `REGISTRATION_MODE`
  env (`open` \| `invite` \| `closed`). A fiók azonnal használható, a megerősítő levél
  párhuzamosan megy. Rate-limit: IP 5/óra és e-mail 3/óra.
- **E-mail-megerősítés** (`/api/auth/verify`, 24 órás token) és **újraküldés** (3/óra).
- **Jelszó-visszaállítás**: `/api/auth/forgot` **mindig 200-at ad** (user-enumeration ellen),
  `/api/auth/reset` egyszer-használatos, 1 órás tokennel.
- **Session-érvénytelenítés**: a token payloadja `uid.ver.exp.hmac`; a reset növeli a
  `users.token_version`-t, a `requireUserId` egyezteti (60 s-os process-cache), így a reset
  kilépteti a többi eszközt. Élettartam 30 nap, a felezőpont után csúszó megújítással
  (a middleware-ben, adatbázis nélkül).
- **Tokenek tárolása**: `auth_tokens` tábla, kizárólag sha256-hash — nyers token sosem kerül DB-be.
- **i18n**: next-intl routing nélkül, a locale a `NEXT_LOCALE` cookie-ból (fallback
  `Accept-Language`, majd `en`), az URL változatlan. Nyelvváltó a TopNavban és a Beállításokon,
  belépve a `users.locale` is őrzi.
- **Az AI a felhasználó nyelvén válaszol**: mind a 9 prompt-építő `locale`-t kap
  (`prompt-locale.ts`), és a locale bekerül az AI-cache kulcsokba (`ai-cache-key.ts`),
  hogy nyelvváltás után ne a régi nyelvű válasz jöjjön vissza.
- **Profil**: monogram-avatar a felhasználónévből (nincs feltöltés, nincs tároló), bio,
  láthatóság-kapcsoló, és a publikus `/u/[username]` oldal (privátnál 404, `noindex`,
  nincs a sitemapban).

## 12/c. Ízlés-jelek és lokális rangsor (2026-07-26)

Spec: `docs/superpowers/specs/2026-07-26-izles-jelek-lokalis-rangsor-design.md`,
terv: `plans/2026-07-26-izles-jelek-lokalis-rangsor.md`.

**Alapelv: az AI tanul, a matek alkalmaz.** A tanulás ritka és emberi tempóhoz kötött
(egy hívás per megírt vélemény), az alkalmazás gyakori és böngészéshez kötött — eddig
fordítva volt súlyozva a költség.

- **Strukturált ízlés-jelek**: az `extract` a szabad szöveges tények mellé kötött
  szókészletű jeleket is ad (`taste-features.ts`: műfaj, tag, format, hossz-sáv, korszak,
  stúdió, forrás). A szókészletet a vélemény tárgyának saját feature-készlete adja, és egy
  szókészlet-őr (`filterSignals`) eldobja, ami nem illik bele. Tárolás: `taste_signal` tábla.
- **Egyesített vektor**: a `buildTasteVector` a viselkedési jel (pont, státusz) mellé
  szemantikus vektort épít a jelekből, külön normalizálva, `α = 0.4` súllyal, ami kevés
  jelnél arányosan csökken. Jel nélkül a kimenet bitre azonos a korábbival.
- **Egy rangsoroló maradt**: a `fit-score`. A gyengébb `candidates.ts`
  (`genreWeights`/`rankCandidates`) törölve — az hajtotta eddig a recommendet, miközben a
  jobbik modell csak a `FitBadge`-et.
- **Lokálisra váltott**: `recommend`, `season-scores`, `upcoming`, és a `vibe`
  leképezhető chipekkel. Az indoklás a vektorból jön (`fit-reason.ts`), nulla modellhívás.
- **AI-próza igényre**: `/api/recommend/explain` — egyetlen hívás gombnyomásra, a rangsort
  nem változtatja. Hiba esetén a lokális indoklás marad, a lista sosem tűnik el.
- **Változatlanul AI-on** (ez a tanulás): `extract`, `profile`, `taste-eras`, `digest`,
  `nl-search`, `duo`, `group-pick`.

**Amit a `vibe` chipekből nem lehet lokálisan pontozni:** a `Hangulat` (5 chip) és a
`Tempó` (2 chip) csoport, valamint a konkrét adaptáció-típusok (manga / light novel /
játék) — ezekre az AniList-nek nincs megfelelője. Ilyen chipnél marad a modell.

## 12/d. UI-redesign: cover-driven kinematografikus arculat (2026-07-26)

Spec: `docs/superpowers/specs/2026-07-26-ui-redesign-design.md`,
terv: `plans/2026-07-26-ui-redesign.md`.

**Alapelv: a színt a tartalom adja.** A shell monokróm marad, a borítók adják a színt —
nincs új brand-hue, nincs light téma, nincs új dependency, és nincs DB-migráció sem: a
poszter-szín a kép CSS blur-kópiájából jön (`.poster-ambient` / `.poster-glow`), nem
kinyert hex-értékből.

**Token-réteg** (`globals.css`): `Instrument Serif` display-vágás (`.display-xl`,
`.display-l`, `.h2`) az `Instrument Sans` törzs mellé; négyszintű felület-skála
(`surface-1/2/3` + surface-0 = puszta whitespace) a `.glass` egyetlen szintje helyett;
filmszemcse + vignetta a lapon; 4px-alapú térköz-, radiusz- és tipo-tokenek;
`--ease-out` + `src/lib/motion.ts` presetek. A `.glass`, `.glass-strong` és `.label-mono`
neve és látványa **változatlan**, mert 13 nem átírt oldal használja őket.

**Primitívek** (`src/components/ui/`): `PageShell`, `SectionHeader`, `Button`, `Chip`,
`ScoreBadge`, `PosterAmbient`, `Skeleton`, `EmptyState`. A `MediaCard` átírva:
üveg-keret nélkül a poszter maga a kártya, a leírás csak hoverre csúszik be, és van
`row` variánsa.

**Shell**: kilenc tab egy húzható pillben → 5 elsődleges + `Több ▾` menü; mobilon a felső
pill helyett **alsó tab-sáv** safe-area paddinggel (ez volt a legnagyobb mobil-hiányosság);
gráf-mark + serif wordmark; kereső-ikon (`/bongeszo?focus=1`); scroll-érzékeny nav-sűrűség.

**Négy átírt oldal**: címlap (új „Ma" hero + hat komponensre vágott `page.tsx` + új
szekció-sorrend, a Társaság már nem a második blokk), címoldal (full-bleed poszter-hero,
a fit-badge a heróba került), `/bongeszo` (sticky szűrő-sáv, vázak, `EmptyState`),
`/lista` (sticky fejléc, haladás-sáv, `+1` a soron — a tábla **tábla maradt**, mert a
rendezhető fejléc a fő funkciója).

**Döntési logika lib-ben, TDD-vel** (+30 teszt: 361 → 391). A projektben csak
node-környezetű `src/lib/*.test.ts` fut, komponens-teszt nincs — ezért a redesign minden
döntése tiszta függvénybe került: `score-color.ts` (7), `nav.ts` (12), `home-hero.ts` (11).

**Gotchák, amiket ez a kör kitermelt:**

- Tailwind v4-ben a v3-as `rounded-[--r-lg]` rövidítés **némán nem működik** —
  `rounded-[var(--r-lg)]` kell, különben szögletes sarok lesz.
- Egy táblázat-wrapper `overflow-hidden`-je scroll-konténert csinál, ami **elrontja a
  `<thead>` `position: sticky`-jét**.
- Az AI-taste-pontszám és a lokális fit-becslés **nem ugyanazon a skálán van**
  (`SCORE_THRESHOLDS`: 70 vs 75), ezért vegyesen rangsorolni hibás.
- Az új alsó tab-sáv **minden** `pb-16`-os oldal alját elfedte → `pb-24 md:pb-16` kellett
  9 oldalon, és `bottom-24 md:bottom-4` a `/graf` fix vezérlőin.

**Scope-on kívül maradt** (szándékosan): a maradék 13 oldal layoutja — a token- és
primitív-csere miatt változtak és jobbak lettek, de nem kaptak egyedi újratervezést;
valamint az i18n-maradék (~30 tsx + 38 API-route). A `CatalogTitlePage` szekció-címkéi
statikus magyar szövegek, mert az ISR-korlát miatt oda nem kerülhet `getTranslations`.

## 13. Mi NINCS még kész / nyitott pontok

| Tétel | Állapot |
|---|---|
| **Push + Vercel-deploy** | ✅ megtörtént: `master == origin/master` (`0a7bf18`), a prod él (`anime-graph.vercel.app`), DB-migrációk lefutottak |
| 🔴 **`APP_URL` hiányzik a Vercel prod-envből** | emiatt a `sitemap.xml`, a `robots.txt` és a JSON-LD `http://localhost:3000`-t adott ki élesben (133 840 sitemap-URL mind rossz). A kód már visszaesik a Vercel prod-domainre, de az **`APP_URL`-t akkor is be kell állítani** — az OAuth-callbackek (`sync-oauth.ts`) is ezt olvassák |
| 🔴 **i18n szöveg-átvezetés félkész** | A next-intl infrastruktúra, a nyelvváltó és az AI-nyelv KÉSZ. A felületi stringek átvezetése a szótárakba viszont még tart: kész a `TopNav`, `FitBadge`, `OnboardingCTA`; hátra ~36 `.tsx` (≈420 sor) és 38 API-route (≈89 hibaüzenet). Az át nem vezetett fájlok magyarul maradnak, az app végig működik. Recept: a terv Task 12-je |
| **D3 élő szinkron** | MAL/AniList OAuth-app-regisztráció + env hiányzik, élő API nem tesztelt |
| **D6 (differenciáló backlog)** | M4 (review-rendszer) utánra ütemezve |
| **M4 review + follow** | a publikus-versenytárs irány következő nagy üteme |
| **Fantom-duel bug** | gyökérok még nyitott |
| ~~ISR-500 a címoldalakon~~ | ✅ javítva 2026-07-25: a stáb-szekció (`6cc0de6`) az `api_cache`-t a no-store `db` klienssel olvasta → `DYNAMIC_SERVER_USAGE` → **minden** `/anime|manga/[slug]` 500 volt prodon. Fix: `api-cache.ts` → `dbStatic`, a cache-olvasás bekerült a `getCachedStaff` try-jába, + forrás-szintű őrszem-teszt (`isr-db-client.test.ts`), mert ez a hiba csak `next build`+`next start` alatt látszik |
| **Liquid-glass kezdőlap** | WIP, stash-ben (`stash@{0}`), `git stash pop`-pal hozható vissza |
| **Első prod-regisztráció** | a usernek kell elsőként regisztrálnia prod-on (id=1 örökli a korábbi adatokat) |
