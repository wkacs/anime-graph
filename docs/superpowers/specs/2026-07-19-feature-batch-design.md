# Feature-batch design — 2026-07-19

Jóváhagyott user-döntések: manga + karakter-réteg + belső VS igen, AI-chat NEM;
Duel + Szezon fül törlés; News vertikális kártya-redesign; Böngésző oldal a teljes
AniList-katalógussal + Random gomb; minden animének angol leírás; Vibe preset-chipek
+ egy custom mező, vertikális eredmény-kártyák. Architektúra: **A** — `mediaType`
oszlop a meglévő `anime` táblán (nem külön manga-tábla).

## 1. Adatmodell + migráció

- `anime` tábla új oszlopok:
  - `mediaType` text NOT NULL default `'ANIME'` (`'ANIME' | 'MANGA'`)
  - `chapters` integer (null = ismeretlen)
  - `volumes` integer
  - `description` text (AniList description, nyers HTML tárolva; strip megjelenítéskor)
  - Manga-sornál `progress` = olvasott chapter; `episodes`/`durationMin` null marad.
  - AniList Media ID globálisan egyedi anime+manga közt → `unique(userId, anilistId)`
    változatlanul érvényes.
- Új tábla `favorite_characters`:
  - `id serial PK, userId int NOT NULL default 1, charId int NOT NULL (AniList character id),
    name text NOT NULL, image text, vaId int, vaName text, vaImage text,
    animeId int NOT NULL FK anime.id ON DELETE CASCADE, createdAt timestamp default now()`
  - `unique(userId, charId)`.
- Migráció: `drizzle-kit push` a Neonra ($env:DATABASE_URL kézzel — a drizzle-kit nem
  olvassa a .env.local-t). Additív oszlopok + új tábla, kézi SQL nem várható.
- Backfill: `scripts/backfill-descriptions` — meglévő animék `description`-je AniList
  `Media(id_in: [...])` 50-es batchekkel (MAL-import minta), csak ahol null.
- `duels` tábla + `anime.elo` oszlop MARAD a DB-ben (adatvesztés nélkül), de kód nem
  használja többé.

## 2. Nav + törlések

- Nav: **News | Gráf | Lista | Böngésző | Vibe | Stats | VS** + Beállítások.
- Törlés: `/duel` + `/szezon` oldalak, `/api/duel*` + `/api/szezon` route-ok, nav-fülek,
  duel-guard süti-logika, `elo.ts` + tesztjei, elo-top5 + utolsó-duelek blokk a
  recommend-promptból, Elo-top10/utolsó-meccsek a Stats-ról.
- Szezon-funkciót a News fedi (szezon-grid már ott van). A `recommendations`
  kind='seasonal' cache-sorok bent maradhatnak (nem olvassa senki).
- Middleware/public prefixek változatlanok.

## 3. Vertikális MediaCard (közös komponens)

- Új `src/components/MediaCard.tsx`: borító felül (2:3), alatta cím, alatta halvány
  műfaj-sor, alatta 2–3 soros angol leírás (HTML-strip + line-clamp), opcionális
  slotok: countdown-badge, ízlés-score badge, akciógombok (Láttam/Nézem/Terv).
- Használat: News követett-kártyák + szezon-grid, Vibe eredmények, Böngésző találatok.
- News-ból VÁLTOZATLANUL marad: napi digest, TonightPicker, heti adásnaptár,
  countdown (az új kártya-layoutban), „Amit követsz" szekció-struktúra.
- Leírás-forrás News/Böngésző/Vibe-nál: közvetlenül az AniList-válasz `description`
  mezője (nem DB); anime-oldalon: DB `description` (add-kor töltve, backfill a régiekre).

## 4. Böngésző + Random (`/bongeszo`)

- `/api/browse` → AniList `Page(media)` proxy. Szűrők: keresés (search), típus
  (ANIME/MANGA), műfaj (genre_in), év (seasonYear/startDate_like), formátum
  (format_in), min. átlagpont (averageScore_greater), rendezés (POPULARITY_DESC /
  SCORE_DESC / START_DATE_DESC); lapozás `page/perPage` (24/oldal). Év-szűrő:
  ANIME-nál `seasonYear`, MANGA-nál `startDate_greater/lesser` FuzzyDateInt-tartomány
  (a mapping pure fn-ben, tesztelve).
- Kártyák: MediaCard + gyorsgombok (Láttam/Nézem/Terv → meglévő POST /api/anime).
- **Random gomb**: (1) aktuális szűrőkkel `Page(perPage:1) pageInfo.total` lekérés,
  (2) `page = 1..min(total, 5000)` véletlen (AniList lapozás-cap), (3) 1 találat →
  ha a user listáján van: a meglévő `/anime/[id]` oldalra visz; ha nincs: új
  **preview-oldal** `/anime/preview/[anilistId]` — AniList-adatból élő render
  (leírás, borító, trailer; a themes + characters proxy anilistId-alapú, így itt is
  működik), „Láttam/Nézem/Terv" hozzáadás-gombokkal; hozzáadás után átirányítás a
  rendes `/anime/[id]`-re. A Böngésző-kártyák címe is ide linkel, ha a találat
  nincs a listán.
- Auth mögött (nav-fül), nem publikus prefix.

## 5. Manga-mód

- Add-flow: AddAnimeSearch típus-választóval (AniList search `type: MANGA`);
  POST /api/anime fogadja a `mediaType/chapters/volumes` mezőket.
- Részletoldal: chapter-progress (+1 chapter gomb, episode_log-ba naplózás marad —
  a heatmap így olvasást is számol), „Befejezted 🎉" modal működik mangára is.
- Gráf: bal-felső toggle **Anime / Manga / Mind** (localStorage-ban tárolt választás),
  graph-builder szűrés mediaType-ra; „Mind"-nél közös műfaj-buborékok vegyes tartalommal.
- Lista: ugyanez a hármas toggle.
- AniList-import: manga-lista is (`MediaListCollection type: MANGA`), közös upsert;
  MAL XML-import anime-only marad (v1).
- Recommend / Vibe / News / TonightPicker manga-t NEM kap (user-döntés).
- Anime-oldali kereszthivatkozás: nem az útvonal változik, a meglévő `/anime/[id]`
  szolgálja ki a manga-sorokat is (címke a formátumból).

## 6. Karakter/seiyuu-réteg

- `/api/characters/[anilistId]`: AniList `characters(role_in:[MAIN,SUPPORTING],
  perPage:12) { node, voiceActors(language:JAPANESE, perPage:1) }` élő proxy
  (nincs DB-cache a teljes castra).
- Anime-oldal új „Szereplők" szekció: kártya-rács (kép, név, seiyuu-név), szív-gomb →
  POST/DELETE `/api/characters/favorite` → `favorite_characters` upsert/törlés.
- Gráf: réteg-toggle „Karakterek" — kedvenc karakterek kis node-ként a saját anime
  node-jukhoz kötve; azonos `vaId`-jú kedvencek közt szaggatott halvány
  „ugyanaz a seiyuu" keresztél. Csak kedvencek kerülnek a gráfba (user-döntés).
- Beállítások/export: a JSON-export kiegészül a favorite_characters-szel.

## 7. Vibe-redesign

- Preset-chipek (multi-select): **Hangulat** vidám/sötét/megható/feszült/kikapcsoló;
  **Műfaj** top-chipek (Action/Romance/Comedy/Drama/Fantasy/SciFi/Slice of Life/
  Thriller); **Hossz** film / rövid (≤13 rész) / normál / hosszú (50+);
  **Korszak** klasszikus (<2000) / 2000-es / 2010-es / friss (2020+);
  **Tempó** lassú-hangulatos / pörgős.
- Alattuk EGY custom szabadszöveg-mező („ha valami kimaradt").
- Chipek + custom → prompt-összeállító pure fn → meglévő POST /api/vibe (a szerver-
  oldali cím-szűrés + enrichment változatlan).
- Eredmény: vertikális MediaCard-lista — „Új felfedezés" elöl, „Hasonlók a listádból"
  hátra (mostani sorrend-logika marad).

## 8. Belső VS

- `/vs` két mód-fül: **AniList user** (mostani flow) | **Belső user** — regisztrált
  username input → `/api/compare?internal=<username>`: a másik user DB-listája
  (`fetchUserList` helyett DB-query) → meglévő `compareLists`.
- Zárt meghívó-kódos kör → minden regisztrált user összehasonlítható, külön
  consent-kapu nincs (vélemények/taste_memory NEM kerülnek a compare-válaszba,
  csak lista-szintű adatok — a publikus-token elv szerint).
- Ismeretlen username → 404 barátságos hibaüzenettel.

## 9. Tesztek + minőségkapuk

- Új pure-fn tesztek: browse-szűrő→GraphQL-változó mapping; random-oldal számítás
  (cap 5000, üres találat); description strip+clamp; karakter-él építés (same-seiyuu
  keresztélek); graph-builder mediaType-szűrés (anime/manga/mind); vibe chip→prompt.
- Elvárás: a megmaradó meglévő tesztek mind zöldek (elo.test.ts + duel-vonatkozású
  tesztek törlődnek a feature-rel együtt), új ~15 teszt jön, `next build` zöld,
  lint tiszta.
- Ismert gotchák betartva: force-graph propok useCallback-kel; template.tsx-be nem
  kerül transform; GLM-hívások AbortSignal.timeout(30s); Neon fetch no-store.

## Nem-célok

- AI-chat (user elvetette), manga a Recommend/Vibe/News-ban, MAL manga-import,
  Elo/duel bármilyen formában, magyar leírás-fordítás (későbbi feature),
  teljes cast tárolása DB-ben.
