# Anime Graph — Teljes funkciólista

*Állapot: 2026-07-24 (HEAD: `c98ae36`, 232 teszt zöld, build zöld)*

Az Anime Graph egy személyes 3D anime-térképből indult, mára egy **publikus, több­felhasználós anime/manga-katalógus és AI-alapú ízléskövető platform** (MAL-versenytárs irány, freemium modellel tervezve). Ez a dokumentum összefoglalja, hogy **most** mit tud az alkalmazás.

---

## 1. Oldalak (route-térkép)

| Útvonal | Mit csinál |
|---|---|
| `/` | Kezdőlap / hírek (News) |
| `/graf` | 3D anime-gráf (a névadó funkció) |
| `/bongeszo` | Katalógus-böngésző (lokális DB-ből, szűrőkkel, fit-badge-ekkel) |
| `/lista` | Saját lista (státuszok, értékelések kezelése) |
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
- Címoldal-tartalom: leírás, karakter-rács (`CharacterGrid`), stáb, **openingek/endingek lejátszó** (`ThemesPlayer`), **streaming-linkek** (`StreamLinks`), közösségi pontszám.
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
- **Vibe-keresés** (`/vibe`): hangulat-presetek + szabad szöveg → ajánlat.
- **Természetes nyelvű keresés** (`/api/search/nl`): „valami rövid, sötét thriller a 2010-es évekből" jellegű lekérdezések.
- **Tonight-picker** (`TonightPicker`): „ma este mit nézzek" gyorsválasztó.
- **Szezon-AI**: az aktuális szezon címeinek AI-pontozása az ízlésedre (`/api/news/season-scores`).
- **Duo-ajánló** (`/api/recommend/duo`): két felhasználó közös ízlésére ajánl.
- **Klub-ajánló (D5, `/vs`)**: több fős csoportnak közös pick (`group-pick`).

## 6. Social / több felhasználó

- **Multi-tenant**: meghívó-kódos regisztráció (felhasználónév + jelszó), session-alapú auth; az első regisztrált fiók örökli a multi-tenant előtti adatokat.
- **Feed**: a többiek aktivitása (`/api/feed`).
- **Közös watchlist** (`/api/watchlist`).
- **Kompatibilitás-% (D4)**: két felhasználó ízlés-egyezése, `CompatChip` a publikus profilon.
- **Publikus profil** (`/p/[token]`): token-alapú, megosztható nézet.
- **Összehasonlítás** (`/api/compare`): listák/ízlések egymás mellett.

## 7. Hírek, szezon, értesítések

- **News-oldal** (`/`): felkapott/szezonális hírek, cache-elve; upcoming-lista visszaszámlálóval (`Countdown`).
- **Szezon-szűrősáv** (`SeasonFilterBar`) + szezon-grid fit-badge-ekkel.
- **Web push értesítések** (`PushToggle`, `/api/push`): epizód-megjelenés (airing-check cron), **szezonváltás-értesítés** a napi cronban.
- **Cron-jobok** (GitHub Actions ütemezéssel): `airing-check` (napi), `time-capsule`.
- **Időkapszula (D8)**: „egy éve ilyenkor néztem/mondtam" visszatekintő cron.

## 8. Import / export / külső szinkron

- **MAL-import** (`/api/import/mal`) és **AniList-import** (`/api/import/anilist`) — teljes lista áthozása, upsert-tel.
- **Kétirányú MAL/AniList-szinkron (D3)**: OAuth-flow (`/api/sync/[provider]/start` + `callback`), `sync_accounts` tábla, visszaírás (`sync-back`) és státusz-lekérdezés. ⚠️ *OAuth-app-regisztráció + env-kulcsok kellenek hozzá, élő API ellen még nem tesztelt.*
- **Export** (`/api/export`): saját adatok kimentése.

## 9. Onboarding és túra

- **`/onboarding` wizard**: import (MAL/AniList) **vagy** AniList top-24-ből seed-kiválasztó; skip-megerősítő; **profil-reveal** (azonnali ízlésprofil a kiválasztottakból); push-engedély kérés.
- **TourSpotlight**: oldalankénti spotlight-túra (news, gráf, böngésző, címoldal) `data-tour` célpontokkal.
- **OnboardingCTA**: kontextusfüggő továbbvezető kártyák a fő oldalakon.

## 10. Wrapped és statisztikák

- **/wrapped**: éves összefoglaló (Spotify Wrapped-stílus, `WrappedCard`).
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
- Tesztek: **232 vitest unit** (DB/hálózat nélkül futnak) + `tsc` + build zöld.
- Env: `DATABASE_URL`, `GLM_API_KEY`, `SESSION_SECRET`, `INVITE_CODE`, opcionális `AI_DAILY_LIMIT`, `OPENROUTER_API_KEY`, push-hoz VAPID-kulcsok, cronhoz `CRON_SECRET`/`APP_URL`.

---

## 13. Mi NINCS még kész / nyitott pontok

| Tétel | Állapot |
|---|---|
| **Push + Vercel-deploy** | 3 commit ahead lokálisan; prod DB-migráció (search_vector is!) **backuppal, sorrendben** kötelező deploy előtt, különben a prod törik |
| **D3 élő szinkron** | MAL/AniList OAuth-app-regisztráció + env hiányzik, élő API nem tesztelt |
| **D6 (differenciáló backlog)** | M4 (review-rendszer) utánra ütemezve |
| **M4 review + follow** | a publikus-versenytárs irány következő nagy üteme |
| **Fantom-duel bug** | gyökérok még nyitott |
| **Liquid-glass kezdőlap** | WIP, stash-ben (`stash@{0}`), `git stash pop`-pal hozható vissza |
| **Első prod-regisztráció** | a usernek kell elsőként regisztrálnia prod-on (id=1 örökli a korábbi adatokat) |
