# Social + AI batch design — 2026-07-19

Jóváhagyott user-döntések: mind a 4 klaszter (social, értesítés, AI, gráf/stat)
kellett; AniList kétirányú sync NEM; egy nagy batch; a már létező idővonal-réteg
és streaming-link marad, de a Wrapped teljes oldallá bővül és a streaming-ikonok
felkerülnek a kártyákra; polish rám bízva (audit-sweep utolsó taskként).

Már létezik, NEM építjük újra: gráf-idővonal (`buildTimeline` + flythrough),
Wrapped canvas-kártya (Stats), `/api/links` streaming-linkek a részletoldalon,
napi email-értesítés (Resend, `airing-check` cron).

## Alapelvek

- **Housemates-modell**: meghívós instance → minden user látja a többit, nincs
  friend-request/követés rendszer. A VS oldal már most is listázza a belső usereket.
- Minden új logika pure fn a `src/lib/`-ben, vitest-tel; a route-ok vékonyak.
- Migráció additív (`db:push`), kézi SQL nem várható.

## 1. Adatmodell (4 új tábla)

- `watchlist_items`: `id serial PK, anilistId int NOT NULL unique, mediaType text
  NOT NULL default 'ANIME', title text NOT NULL, coverUrl text, addedBy int NOT NULL
  (users.id), watchedEpisodes int NOT NULL default 0, createdAt timestamp default now()`
  — EGY globális közös lista az instance-nek (nincs multi-lista, nincs userId-szűrés).
- `push_subscriptions`: `id serial PK, userId int NOT NULL, endpoint text NOT NULL
  unique, p256dh text NOT NULL, auth text NOT NULL, createdAt timestamp default now()`.
- `notified_airing`: `id serial PK, anilistId int NOT NULL, episode int NOT NULL,
  createdAt timestamp default now(), unique(anilistId, episode)` — push-dedup.
- `anime_staff`: `id serial PK, userId int NOT NULL, animeId int NOT NULL FK anime.id
  ON DELETE CASCADE, staffId int NOT NULL (AniList staff id), name text NOT NULL,
  image text, role text NOT NULL, createdAt timestamp default now(),
  unique(userId, animeId, staffId)` — elsőre csak rendező (role="Director").
- Feed-hez NINCS új tábla (derivált, lásd 2.).

## 2. Barát-feed (News „Társaság" szekció)

- Derivált union-feed a meglévő táblákból, user-szűrés nélkül, majd a kérő user
  saját eseményei kiszűrve:
  - `anime.createdAt` → „X hozzáadta: <cím>" (státusz szerint: Láttam/Nézem/Terv)
  - `opinions.createdAt` → „X véleményt írt: <cím>" (a szöveg első ~120 karaktere)
  - `episode_log.createdAt` → „X megnézte/elolvasta: <cím> EP/ch N" (napi szinten
    összevonva: „X ma 3 részt nézett a <cím>-ből")
  - `favorite_characters.createdAt` → „X kedvence lett: <karakter> (<cím>)"
- Limitáció (elfogadva): „befejezte" esemény nincs — a státuszváltásnak nincs
  timestampje.
- `src/lib/feed.ts`: `buildFeed(rows...) → FeedItem[]` pure fn (rendezés,
  epizód-összevonás, kiszűrés), tesztekkel. Route: `GET /api/feed?limit=30`.
- UI: News oldalon új „Társaság" szekció (avatár helyett username-monogram,
  relatív idő, cím linkel a saját `/anime/[id]`-re ha listán van, különben
  `/anime/preview/[anilistId]`-re).

## 3. „Mit nézzünk ketten?" (VS oldal)

- VS oldalon a kiválasztott belső user mellé gomb → `POST /api/recommend/duo`
  `{ otherUserId }`.
- Jelölt-pool: mindkét user `planned` listája + AniList-recommendations a közös
  kedvencekből (mindkettőnél score ≥ 8), kiszűrve minden cím, amit BÁRMELYIK user
  már látott/néz. `src/lib/duo.ts` pure fn, tesztekkel.
- GLM-prompt: mindkét user taste_memory top-N tény + jelölt-lista → 5 cím,
  indoklás mindkét ízlés felől („neked azért, neki azért").
- Cache: `recommendations` tábla `kind='duo:<minId>:<maxId>'`, 24h TTL.
  AI-quota a kérő userre számít.

## 4. Közös watchlist

- CRUD: `GET/POST/DELETE /api/watchlist` (+ `PATCH` a közös `watchedEpisodes`
  léptetéshez). Bárki hozzáadhat/törölhet/léptethet (housemates).
- UI: News „Társaság" szekció alatt „Közös lista" blokk MediaCard-okkal
  (ki adta hozzá + közös progress-számláló, +1 gomb); hozzáadás-gomb a
  Böngésző/News kártyákon és a részletoldalon („Közösbe" gomb).

## 5. Web push + cron-átalakítás

- `web-push` npm lib; env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (mailto). `public/sw.js` service worker (push event → notification,
  klikk → app fókusz/megnyitás).
- Beállítások-oldal: „Push-értesítés engedélyezése" gomb → `PushManager.subscribe`
  → `POST /api/push/subscribe`; kikapcsolás → DELETE.
- `airing-check` átalakítás:
  - userId=1 hardcode KI → minden user followed (watching/planned) animéi.
  - Push minden usernek, akinek van subscriptionje; email marad plusznak, ahol
    `RESEND_API_KEY` + `NOTIFY_EMAIL` (owner).
  - Ablak: a következő 70 percben adásba kerülő epizódok; dedup a
    `notified_airing` táblával (unique insert, konfliktusnál skip).
  - Payload-builder pure fn (`src/lib/push.ts`), tesztekkel; lejárt/érvénytelen
    subscription (410) törlése.
- Időzítés: Vercel hobby napi cron marad (email-digest 6:00), MELLÉ GitHub
  Actions workflow (`.github/workflows/airing-cron.yml`) óránként curl-lel,
  `CRON_SECRET` headerrel — tippbot/flipbot minta.

## 6. Természetes nyelvű keresés (Lista)

- Lista oldal keresője mellé „AI"-gomb → `POST /api/search/nl` `{ query }`.
- Prompt: a user teljes listája kompakt JSON-ban (id, cím, műfajok, év, score,
  státusz, vélemény-kivonat ~100 char) + a kérdés → GLM →
  `{ matchIds: number[], answer: string }`.
- `src/lib/nl-search.ts`: prompt-builder + válasz-parser (defenzív JSON-parse,
  id-validálás a lista ellen), tesztekkel. Quota-guarded, nincs cache.
- UI: találatok kiemelve/elé rendezve a Listán + válaszbuborék a kereső alatt.

## 7. Ízlés-evolúció (Stats)

- Chart AI nélkül: opinions score-átlag + vélemény-darabszám havi bontásban
  (`src/lib/evolution.ts` aggregátor, tesztekkel) — egyszerű SVG/CSS chart a
  Stats meglévő stílusában.
- „Korszakaim" gomb: taste_memory időrendben → GLM 3–5 korszak (címke +
  2-3 mondatos összefoglaló + időszak) → cache `recommendations`
  `kind='taste-eras'`; invalidálás: új vélemény mentésekor a cache-sor törlése.

## 8. Szezon-preview AI-rangsor (News)

- News-ba „Következő szezon — neked" blokk: a KÖVETKEZŐ szezon AniList-listája
  (meglévő seasonal-minta) → tag-átfedéses előszűrés a taste-tel (meglévő
  `candidates` minta, top ~20) → GLM top-8 rangsor rövid indoklással →
  MediaCard-grid.
- Cache: `recommendations` `kind='seasonal-ai:<year>-<season>'`, 7 nap TTL.

## 9. Staff/rendező gráf-réteg

- Adat: AniList `Media.staff` → csak "Director" role; töltés add-flow-ban +
  AniList-importban + `scripts/backfill-staff.mjs` (50-es batch, description-backfill
  minta).
- Gráf: „Stáb" toggle a karakter-toggle mellé (localStorage); `buildStaffLayer`
  a `buildCharacterLayer` mintájára — rendező-node-ok a saját animéikhez kötve,
  kereszt-link, ha ugyanaz a rendező több animénél. Idővonal-módban a réteg
  kikapcsol (mint a karakter-réteg). Tesztekkel.

## 10. Wrapped teljes oldal

- Új út: `/wrapped` (auth mögött, NEM nav-fül — a Stats oldalról link), év-választó
  (amelyik években van adat).
- Scroll-snap slide-ok: (1) össz-órák + darabszám, (2) top műfajok, (3) top
  stúdiók, (4) top-5 anime score szerint, (5) leghosszabb napi streak
  (episode_log), (6) kedvenc karakterek, (7) manga-stat (ha van), (8) záró:
  meglévő WrappedCard canvas-kép letöltés-gombbal.
- Aggregáció: `src/lib/wrapped.ts` pure fn (év-szűrt lista + episode_log →
  slide-adatok), tesztekkel. Stílus: meglévő liquid-glass/dark, slide-onként
  belépő animáció.

## 11. Streaming-ikonok kártyákra

- A News/Böngésző/Vibe AniList-query-jeibe bekerül az
  `externalLinks { site url type }`; a MediaCard opcionális `streamingLinks`
  propot kap → kis ikonsor (max 3, tooltip a site-névvel, új fülre nyit).
- DB-forrású kártyákon (Lista) NINCS — csak AniList-forrásúakon. N+1 hívás tilos.

## 12. Polish sweep (utolsó task)

- Végigmegyek minden oldalon (News, Gráf, Lista, Böngésző, Vibe, Stats, VS,
  részletoldal, Beállítások) és az apró UX-hibákat javítom; a talált+javított
  listát a task végén dokumentálom.
- Ismert tétel: az `airing-check` userId=1 hardcode az 5. pontban megszűnik.

## Tesztek + migráció

- `db:push` additív: 4 új tábla (1. pont). PowerShell: `$env:DATABASE_URL` kézzel.
- Új pure fn tesztek: feed-union, duo-candidates, NL-prompt/parser, evolution-
  aggregátor, staff-layer builder, wrapped-aggregátor, push-payload builder.
- Meglévő 85+ teszt zöld marad; build zöld.
