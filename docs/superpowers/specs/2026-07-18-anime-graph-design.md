# Anime Graph — 3D anime-lista + ízlés-memória + AI-ajánló

Dátum: 2026-07-18
Státusz: jóváhagyásra vár

## Cél

Személyes anime-katalógus egyetlen látványos 3D gráf-térben (Obsidian 3D-graph élmény),
animénként személyes véleménnyel, amelyből AI tömör ízlés-memóriát épít. **A fő funkció
egyetlen "Recommend me" gomb**: megnyomásra a teljes ízlés-profil alapján ajánl új animéket
indoklással. Minden más funkció extra e köré.

Egyfelhasználós, hobbi-projekt. Nem cél: multi-user, natív mobil app, offline mód, manga.

## Stack és infra

- **Next.js (App Router) + TypeScript**, Vercel-re szánva
- **Neon Postgres + Drizzle ORM**
- **react-force-graph-3d** (Three.js-alapú) a 3D gráfhoz, bloom utóeffekttel
- **GLM `glm-4.7-flash`** (ingyenes) minden AI-feladathoz
- **AniList GraphQL API** (kulcs nélküli, publikus) metaadat-forrásként, szerveroldali proxyn át
- Vercel- és Neon-fiókot, env-beállítást **a felhasználó maga intézi** (céges fiókokhoz a kód
  és az agent nem nyúl). A kód csak env-változókat vár:
  - `DATABASE_URL` — Neon connection string
  - `GLM_API_KEY` — GLM API kulcs
  - `APP_PASSWORD` — belépési jelszó
  - `SESSION_SECRET` — cookie-aláíráshoz

## Hozzáférés

Egyszerű jelszavas belépés: `APP_PASSWORD` env + aláírt cookie-session. Minden oldal és
API írás/olvasás védett, kivéve a `/login`.

## Oldalak

| Útvonal | Tartalom |
|---|---|
| `/` | 3D gráf-tér (fő nézet) + oldalpanel + prominens "Recommend me" gomb |
| `/stats` | Statisztika-dashboard |
| `/duel` | Elo-alapú páros rangsoroló |
| `/settings` | Ízlés-listák, hierarchia-alapbeállítás, import |
| `/login` | Jelszavas belépés |

## Adatmodell

### `anime`
- `id` (serial PK), `anilist_id` (unique)
- Címek: `title_romaji`, `title_english`, `title_native`
- Meta: `cover_url`, `banner_url`, `genres text[]`, `tags jsonb` (név+rank), `studio`,
  `season`, `year`, `episodes`, `duration_min`, `format`, `relations jsonb`
  (AniList-relációk: sequel/prequel/spinoff, anilist_id-kkal), `avg_score` (AniList-átlag)
- Saját: `status` (`watching | completed | dropped | planned`), `progress` (epizód),
  `my_score` (1–10, opcionális), `elo` (default 1200), `watched_at` (mikor néztem — timeline-hoz),
  `created_at`
- Elsődleges műfaj = `genres[0]` (AniList sorrend) — hierarchia-elhelyezéshez

### `opinions`
- `id`, `anime_id` (FK, 1:1), `raw_text` (teljes nyers vélemény), `extract_status`
  (`pending | done | failed`), `updated_at`

### `taste_memory`
- `id`, `anime_id` (FK, nullable — globális bejegyzésnél üres)
- `kind` (`like | dislike | note`), `text` (rövid magyar tény, pl. "time-travel plot tetszett")
- `source` (`opinion | settings | duel`), `weight` (float, default 1), `created_at`
- Vélemény újrakivonatolásakor az adott anime `source=opinion` sorai cserélődnek

### `settings`
- Kulcs-érték: globális "nagyon szeretem" / "nem szeretem" szabadszöveges listák,
  hierarchia-alapbeállítás (JSON), egyéb UI-preferenciák

### `duels`
- `id`, `winner_id`, `loser_id`, `created_at`

### `recommendations`
- `id`, `kind` (`recommend | vibe | seasonal`), `input jsonb` (prompt + kiválasztott animék),
  `result jsonb`, `created_at` — cache + előzmény

## 3D gráf-tér

### Hierarchia (konfigurálható)
- A gráf **hierarchikus**: középső szintektől kifelé rétegek, levelek = anime-node-ok.
- Szint-lánc a gráf melletti panelen állítható: **sorrend húzható, szintek ki/be kapcsolhatók**.
- Választható dimenziók: **műfaj, stúdió, pontszám-sáv (1–4 / 5–6 / 7–8 / 9–10), év/szezon, státusz**.
- Default lánc: műfaj → stúdió → anime.
- Több műfajú anime az **elsődleges műfaja** alá kerül (nincs hajszál-gubanc).
- Opcionális **kereszt-él kapcsoló**: sequel/prequel/spinoff élek az anime-node-ok közt,
  a hierarchiától függetlenül.
- Konfig-változásnál a node/link-lista újraépül, a force-layout animálva rendeződik át.

### Vizuál
- Anime-node = borítókép-lap (sprite/plane); dimenzió-node = feliratos gömb.
- Node-méret = saját pontszám vagy Elo (kapcsolható).
- Státusz-színkód: kész = teli, nézem = pulzáló ring, tervezett = halvány, dropped = szürke.
- Sötét űr-háttér, bloom glow (react-force-graph-3d `postProcessingComposer`).
- Keresőmező / node-klikk → kamera fly-to.

### Oldalpanel (anime-node klikkre)
- Borító, címek, meta, AniList-link
- Státusz + progressz állítás, pontszám
- **Vélemény-szerkesztő** (mentéskor AI-kivonat, lásd AI-réteg)
- Kivonatolt ízlés-tények listája (szerkeszthető/törölhető)
- **Opening/OST**: AniList `trailer` mező alapján beágyazott YouTube-lejátszó (lazy-load),
  ha nincs trailer, "Opening keresése YouTube-on" link (`<cím> opening` kereséssel)

### Timeline-mód
- Kapcsoló: a gráf idő-tengelyre rendeződik `watched_at` szerint, kamera végigrepül
  a kronológián. Vissza-kapcsolásra normál force-layout.

## AI-réteg (GLM flash)

### Vélemény → ízlés-memória
1. Vélemény mentése: `raw_text` azonnal DB-be (`extract_status=pending`).
2. Háttérben GLM-hívás: 3–8 rövid magyar tény kinyerése (mi tetszett / mi nem / kiugró elem),
   strukturált JSON-válasz → `taste_memory` sorok (`source=opinion`).
3. GLM-hiba esetén a vélemény megvan, státusz `failed`, UI-ban "újrapróbálás" gomb.
4. Vélemény szerkesztésekor a kivonat újragenerálódik (régi `opinion`-sorok cserélve).

### Recommend me (FŐ funkció)
1. **Jelöltgyűjtés algoritmikusan** (GLM nélkül): AniList-recommendations a legjobbra
   értékelt animéimből + tag-átfedéses keresés + aktuális szezon; már listázott animék kizárva.
2. Jelöltek (~30) + teljes `taste_memory` + globális listák + Elo-toplista → **GLM rangsorol**,
   5–10 ajánlást ad **személyes indoklással** ("a Steins;Gate-nél a plot-twisteket dicsérted…").
3. Eredménykártyák: borító, indoklás, "tervezem-hez ad" gomb. Futás cache-elve
   (`recommendations`), ismételt nyomásra friss futás.

### Vibe-keresés
- Szabadszöveges prompt ("olyat mint a Monogatari, de rövidebb").
- **"+" gomb → anime-picker** a saját listából (borító + név, kereshető): a kiválasztott
  animék **explicit kontextusként fixen bemennek** a GLM-hívásba, akkor is, ha a szövegben
  nem szerepelnek.
- GLM a taste_memory + kiválasztott animék alapján válaszol: találatok a saját listából
  és/vagy új ajánlások, jelölve melyik melyik.

### Duel / Elo
- `/duel`: két anime (párosítás: hasonló Elo ± zaj), egy kattintás a győztesre → Elo-frissítés
  (K=32). Elo beszámít az ajánló súlyozásába és opcionálisan a node-méretbe.

### Szezonális radar
- AniList aktuális + következő szezon listája → batch GLM-scoring az ízlés-profil alapján
  ("ez neked való lesz" 0–100 + egysoros indok), eredmény cache-elve szezononként.

## Statisztika (`/stats`)
- Műfaj-radar chart, össz óraszám (epizód × hossz), év/szezon-bontás, stúdió-toplista,
  pontszám-eloszlás, státusz-megoszlás.

## Import
- **AniList**: publikus username-alapú listaimport (pontszámokkal, státusszal) GraphQL-ből.
- **MAL**: exportált XML feltöltése, parseolás, AniList-re mappelés `idMal` alapján.

## Hibakezelés
- GLM 429/timeout → exponenciális backoff + retry; UI-toast, kivonatnál `pending/failed` állapot.
- AniList rate-limit (90 req/perc) → minden meta DB-ben tárolva, API csak keresésnél/importnál/
  szezonlekérésnél; szerveroldali fetch egyszerű memória-cache-sel.
- Minden AI-válasz JSON-séma ellen validálva (zod); parse-hiba = retry egyszer, aztán hibaüzenet.

## Tesztelés
- **vitest** unit: jelölt-scoring (tag-átfedés), Elo-számítás, GLM-válasz parseolás/validálás,
  hierarchia-gráf építés (node/link-generálás minden dimenzió-kombinációra), MAL XML parse.
- Kézi smoke + Playwright-screenshot a gráf-nézetre (renderel-e, node-klikk panel nyílik-e).

## Nyitott kérdések / későbbre
- OpenRouter failover-kulcs GLM mellé (tippbot-minta) — first release-ben csak retry.
- Megosztható publikus nézet (most: minden jelszó mögött).
- Projekt végleges neve (munkanév: anime-graph).
