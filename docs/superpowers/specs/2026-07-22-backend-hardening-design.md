# Backend-hardening — design spec (2026-07-22)

Négy backend/architektúra workstream az AniGraph-hoz. **UI/styling nincs érintve.**
Stack: Next.js 15 + React 19, Neon Postgres + Drizzle, GLM `glm-4.7-flash` (OpenRouter/deepseek-free fallback).

## Cél

1. **Adatforrás-migráció** — AniList-függőség csökkentése az offline-db (manami) bevezetésével.
2. **Réteges AI-kvóta** — free/paid tier + endpointonkénti limit + valós költség-logolás.
3. **Publikus link biztonsági audit** — `/p/[token]` sosem szivárogtat véleményt/ízlés-adatot.
4. **Core loop stabilizáció** — Recommend/Vibe/Wrapped edge-esetek + graceful AI-fallback.

## Döntés-napló (brainstorm forkok)

- **D1 — Data model:** offline-db a **MEGLÉVŐ `title` katalógusba** töltődik, NEM új `anime_metadata` tábla. Egy igazságforrás; M2 óta a Böngésző/keresés/slug MÁR `title`-ből olvas.
- **D2 — MAL-only entry-k:** **Opció A** (enrich-only most). AniList-source-os entry insertelődik; MAL-only entry csak MEGLÉVŐ `title`-sort matchel `malId`-n és enrichel + hiányzó `malId`-t backfillel. MAL-only ÚJ cím KIMARAD (dokumentált coverage-gap, lásd *Out of scope*). A `title.anilistId` notNull + `anime` view érintetlen.
- **D3 — Friss-import NULL-mezők:** offline-db `score.median` → `avgScore` importkor (azonnali rangsor-jel); a workflow láncolja `backfill-descriptions.mjs --only-missing`-et; `communityScore` szándékosan NULL user-értékelésig (a mi bayesian metrikánk, nem katalógus-adat).
- **Script-konvenció:** `.mjs` (a 7 létező script mind az), node-dal futtatva. A spec-beli `.ts` felülírva.
- **Cron:** GitHub Actions (a létező `catalog.yml`/`airing-cron.yml` mintára), NEM Vercel Cron (60s cap + több MB JSON).

---

## WS1 — offline-db → `title`

### Import script: `scripts/import-offline-db.mjs`

- **Forrás:** `https://raw.githubusercontent.com/manami-project/anime-offline-database/master/anime-offline-database-minified.json` (MIT). `data[]` iterálás.
- **AniList-id kinyerés:** `sources[]` URL-ekből regex `anilist\.co/anime/(\d+)`. Nincs AniList-source → nincs insert (lásd D2).
- **Mező-map (offline-db → `title`):**

  | offline-db | title oszlop | megjegyzés |
  |---|---|---|
  | `title` | `titleRomaji` | |
  | `synonyms[]` | (nem tárolt külön) | search_vector úgyis csak romaji/en/native |
  | `picture` | `coverUrl` | |
  | `episodes` | `episodes` | |
  | `animeSeason.season` / `.year` | `season` / `year` | UNDEFINED → NULL |
  | `studios[0]` | `studio` | ha van (újabb DB-verzió) |
  | `tags[]` | `tags` (TagEntry[], rank=0) + `genres` (metszet az ismert AniList-genre-listával) | offline-db nincs külön genres |
  | `relatedAnime[]` (URL-ek) | `relations` (RelationEntry, `type:'RELATED'`, anilistId parse-olva, `title:''`) | offline-db NEM ad típusos sequel/prequel-t |
  | `score.median` | `avgScore` | ×10 ha 0–10 skála; hiányzik → NULL |
  | (parse malId `sources`-ból) | `malId` | `myanimelist.net/anime/(\d+)` |

- **🔴 Szelektív upsert** — `onConflictDoUpdate` target `(anilistId, mediaType)`, `set` KIZÁRÓLAG a bulk-meta oszlopokra:
  `coverUrl, episodes, season, year, studio, tags, genres, malId (ha null volt), syncedAt`.
  **NEM írja felül:** `description`, `relations` (ha már típusos AniList-adat van benne — ürescheck: csak akkor írja, ha a meglévő `relations` üres tömb), `communityScore`, `communityCount`, `popularity`, `avgScore` (ha már AniList-enrichelt — offline `score` csak NULL avgScore-t tölt), `bannerUrl`, `trailer*`. Insertkor minden offline-mező bekerül.
- **Batch:** chunkolt upsert (pl. 500/tétel), `syncedAt` bélyeg. Idempotens.
- **Új-ID gyűjtés:** a script kiírja az újonnan beszúrt anilistId-ket (stdout/JSON), hogy a workflow következő lépése a description-backfillt csak azokra futtassa.

### Read-repoint (élő AniList → lokális `title`)

| Hely | MOST | UTÁN |
|---|---|---|
| `recommend/route.ts` rec-pool | `fetchRecommendationsFor(anilistId)` ×5 élő | lokális pool a `title`-ből: top-5 kedvenc `relations` ID-i + azonos genre/tag magas `communityScore ?? avgScore` címek, owned kiszűrve |
| `browse/route.ts` + `bongeszo` | `fetchBrowse` élő | `title`-query: genre/year/format/minScore szűrő + sort (`POPULARITY_DESC→popularity`, `SCORE_DESC→communityScore??avgScore`, `START_DATE_DESC→year`), lapozás, `random` = `ORDER BY random() LIMIT 1` |
| `news/route.ts` seasonal+airing | minden betöltésnél élő | **cache-elve** (lásd lent) |

**Rec-pool minőség — spec-döntés (user-review):** a lokális pool tartalom-alapú (genre/tag/relations), gyengébb mint az AniList kollaboratív „users who liked X" jel. **Ajánlott középút:** a `fetchRecommendationsFor` NEM tűnik el, hanem a heti sync **batch-be cache-eli** per-title egy `title_recommendations` táblába (nem élő, nem per-request) → a rangsor megőrzi a kollaboratív jelet, de az AniList-hívás heti 1×, nem oldalbetöltésenként. Ha egyszerűbb kell: tiszta tartalom-alapú pool, a cache-tábla elhagyva. **Döntsd el a spec-review-nál.**

### AniList marad (alacsony frekvencián, a spec szerint)

- `backfill-descriptions.mjs` — leírás-enrichment (import után láncolva).
- **seasonal/airing** (News/Szezon) — **cache:** `fetchSeason` napi TTL, `fetchAiringFor` óránkénti TTL. Tárolás: `recommendations` tábla `kind='cache:season:Y-S'` / `kind='cache:airing'` mintára (date-cache, mint a szezon-AI), vagy külön `api_cache(key, value jsonb, expiresAt)` tábla. **Ajánlott:** kis `api_cache` tábla (tiszta, TTL-explicit). A News/Szezon a cache-ből olvas, lejáratkor frissít.
- **external-user import** (VS `fetchUserList`) — idegen AniList-lista, nem kiváltható.
- **search-fallback** (add-flow, `/api/search` már title-first, AniList csak ha nincs katalógusban) — változatlan.
- characters/links/themes anime-oldali enrichment — title-first, AniList fallback (jelen specben minimál; ha title-ben van elég, onnan).

### Heti cron (GitHub Actions)

`.github/workflows/offline-db-sync.yml` — heti ütem:
1. `node scripts/import-offline-db.mjs` (upsert + új-ID lista)
2. `node scripts/backfill-descriptions.mjs --only-missing` (új/NULL-description ID-kra)
3. (opcionális) `node scripts/recompute-scores.mjs`
Repo-secret: `DATABASE_URL`. A scriptek `process.env.DATABASE_URL`-t olvasnak (nem `.env.local`).

---

## WS2 — réteges AI-kvóta

### Séma

- **`users.tier`** oszlop: `text notNull default 'free'` (`'free' | 'paid'`). Migráció.
- **`ai_usage_log`** új tábla:
  ```
  id serial pk, userId int notNull, endpoint text notNull,
  model text notNull, promptTokens int notNull default 0,
  completionTokens int notNull default 0, estCostUsd real notNull default 0,
  createdAt timestamp notNull defaultNow
  ```

### Limit-konfig (`src/lib/ai-quota.ts`)

```
const LIMITS = {
  recommend: { free: 5,  paid: 50  },
  vibe:      { free: 10, paid: 100 },
  // default fallback endpointokra, amik nincsenek itt:
  default:   { free: 20, paid: 200 },
}
```
- `consumeAiQuota(userId, endpoint)` — kulcs `aiDay:${day}:${endpoint}`; a limit `LIMITS[endpoint]?.[tier] ?? LIMITS.default[tier]`; a tier a `users`-ből. Env-override marad (`AI_DAILY_LIMIT`) mint globális felső kalap.

### Költség-log (`src/lib/glm.ts`)

- **`AI_COST_PER_1K_TOKENS`** konfig:
  ```
  const AI_COST_PER_1K_TOKENS = {
    'glm-4.7-flash': { prompt: 0, completion: 0 },        // free tier
    'deepseek/deepseek-chat-v3-0324:free': { prompt: 0, completion: 0 },
    // jövőbeli paid modell(ek) valós egységára ide:
    // 'glm-4-plus': { prompt: 0.001, completion: 0.001 },
  }
  export function estimateCost(model, promptTok, completionTok) { ... } // /1000 * ár
  ```
- **`glmChat(messages, opts)`** bővül `{ userId?, endpoint?, retries? }`-re. A válasz `usage` mezőjéből (`prompt_tokens`, `completion_tokens`) — GLM és OpenRouter is adja — **a `glmChat`-en belül** beszúr egy `ai_usage_log` sort (`estCostUsd = estimateCost(...)`). Így a ~15 hívót nem kell a visszatérési értékre átírni; a `userId`/`endpoint` átadása opcionális (hiányában nem logol). Free-modellnél is tárol tokent (cost=0) → paid-váltáskor historikus volumen valós költséget vetít.
- `usage` hiánya esetén becslés a `content.length`-ből (≈4 char/token), hogy sose 0 legyen ha volt válasz.

---

## WS3 — publikus link biztonsági audit

- **Jelenlegi állapot:** `/api/public/[token]/route.ts` MÁR biztonságos — `anime` view-t SELECT-el, de a válaszba csak `title, coverUrl, status, myScore, year` map-elődik; opinions/tasteMemory/rawText nincs is lekérdezve.
- **Megerősítő munka:**
  1. **Fehérlista-szerializáló** `src/lib/public-view.ts` → `toPublicAnime(row)` a whitelist-mezőkkel; a route ezt használja (jövőbeli edit sem szivárogtathat).
  2. **Regressziós teszt** (`public-view.test.ts` + route-szintű): a válasz-objektum kulcsai a whitelist ⊆; explicit assert hogy `rawText`, `text`, `extractStatus`, taste-mezők NINCSENEK benne, még ha a bemenet-row tartalmazza is őket.
  3. **`/p/[token]/page.tsx` átnézés** — csak a `/api/public/[token]` endpointot hívja-e (más user-scoped API-t nem).
  4. **Checklist** a spec végén (lásd *Security checklist*).

---

## WS4 — core loop stabilizáció

- **recommend + vibe — stack-leak fix:** `catch (e) { ... String(e) ... }` → barátságos, fix üzenet (`'Az AI most nem elérhető, próbáld újra pár perc múlva'`), a nyers hiba csak `console.error`-ba. (WS3-hoz is kapcsolódik: ne szivárogjon belső infó.)
- **wrapped — üres-lista edge:** 0 anime / 0 epizód / nincs adott évi adat → `buildWrapped` NE dobjon (nullázott struktúra + `years:[]`). Teszt: üres bemenet nem száll el, definit `0`/`null` mezők.
- **vibe — üres eredmény:** GLM 0 új + 0 saját pick → nem hiba, üres listák (a UI kezeli). `enrichNewPicks` per-pick try/catch már van.
- **seasonal/News — üres szezon:** `fetchSeason().catch(()=>[])` már van; a cache-réteg (WS1) NULL/üres esetén nem cache-el negatívat hosszan (rövid negatív-TTL, a szezon-AI mintájára).
- **Graceful AI-fallback:** GLM→deepseek már a `glm.ts`-ben; a route-ok mindig JSON-hibát adnak (nem 500-crash). Ellenőrzés: minden AI-route `try/catch`-elt és 4xx/502-t ad, sosem hagyja el-szállni az oldalt.
- **Tesztek:** recommend (0-anime, 0-candidate, GLM-throw→fix üzenet), vibe (0-anime, GLM-throw), wrapped (üres), ai-quota (tier/endpoint limit), cost (estimateCost), public-view (whitelist).

---

## Adatmodell-változások összefoglaló

- **Új oszlop:** `users.tier text notNull default 'free'`.
- **Új táblák:** `ai_usage_log`; `api_cache` (seasonal/airing); *(opcionális, review-függő)* `title_recommendations`.
- **`title`:** nincs séma-változás (offline-db a meglévő oszlopokba tölt); `malId` már létezik.
- **Migrációk:** raw-SQL `.mjs` (a `migrate-catalog-split.mjs` mintára), idempotens, Neon-branch dry-run cutover előtt. Drizzle `schema.ts` frissítés a típusokhoz.

## Tesztstratégia

- **Offline (én verifikálom):** vitest (mockolt db/fetch) + `tsc` + `eslint` mind zöld. Új tesztek a fenti listából.
- **DB-runtime (user futtatja Neonon):** migrációk + `import-offline-db.mjs` dry-run branchen → verify → app-smoke → cutover backuppal.

## Logisztika

- **Branch:** új `feature/backend-hardening` a jelenlegi HEAD-ről (=`1fa8951`). A working-tree uncommitted **design-változásait NEM érintem** (page.tsx, GlassCard, globals.css, HeroSlideshow, dominant-color, anilist.ts stb.). Git-commit/push a useré.
- **DB-runtime:** minden Neon-migrációt a user futtat (offline nem verifikálható).

## Out of scope / follow-up

- **MAL-only ÚJ címek insertje** (D2 Opció B): `anilistId` nullable + duál-unique + `anime` view notNull-lazítás + ~90 olvasóhely audit. Külön milestone, ha a coverage-gap fájni kezd.
- Anime-oldali characters/staff/themes teljes title-be költöztetése (most title-first + AniList-fallback marad).
- Tényleges Stripe-fizetés a paid-tierhez (most csak flag).

## Security checklist (WS3)

- [ ] `/api/public/[token]` válasz kulcsai ⊆ whitelist (`username`, `stats`, `anime[].{title,coverUrl,status,myScore,year}`).
- [ ] `rawText` / `opinions` / `tasteMemory` / `extractStatus` SOHA nincs a válaszban (row tartalmazza is → serializer levágja).
- [ ] `/p/[token]/page.tsx` csak a publikus endpointot hívja.
- [ ] Érvénytelen/visszavont token → 404, nincs adat-leak.
- [ ] Regressziós teszt lockolja a fentit.
