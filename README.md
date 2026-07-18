# Anime Graph

Személyes 3D anime-térkép: hierarchikus gráf (műfaj → stúdió → anime, kapcsolható
szintekkel), animénkénti vélemények AI-ízlésmemóriával, és egy "Recommend me" gomb,
ami GLM-mel ajánl a saját ízlésed alapján.

## Beüzemelés (kézzel, saját fiókokkal!)

1. Neon: hozz létre adatbázist, másold ki a connection stringet.
2. `.env.local` a repo gyökerébe (minta: `.env.example`):
   - `DATABASE_URL`, `GLM_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET`
3. Séma feltolása (a drizzle-kit NEM olvassa a `.env.local`-t automatikusan):
   - PowerShell: `$env:DATABASE_URL="postgres://..."; npm run db:push`
4. `npm install`, majd `npm run dev` → http://localhost:3000
5. Vercel: importáld a repót a SAJÁT (nem céges!) fiókodba, állítsd be ugyanezt
   a 4 env-változót, deploy.

## Parancsok

- `npm run dev` / `npm run build` — fejlesztés / build (⚠️ ne futtasd a kettőt egyszerre,
  közös a `.next` mappájuk)
- `npm run test` — vitest unit tesztek (DB/hálózat nélkül futnak)
- `npm run db:generate` / `npm run db:push` — Drizzle migrációk

## Architektúra

- `src/lib/` — tesztelt tiszta logika: `graph-builder` (hierarchia → node/link),
  `candidates` (jelölt-rangsor), `extract` (vélemény → ízlés-tények), `glm`, `anilist`
- `src/app/api/` — vékony route-ok a libek fölött
- `src/components/` — `Graph3D` (react-force-graph-3d + bloom), `SidePanel`,
  `HierarchyPanel`, `AddAnimeSearch`, `RecommendModal`

## Hogyan működik az ajánló

1. Vélemény mentésekor a GLM (`glm-4.7-flash`) 3–8 rövid ízlés-tényt nyer ki
   → `taste_memory` tábla (a nyers szöveg is megmarad).
2. "Recommend me": a legjobbra értékelt animéid AniList-recommendation-poolja
   → tag-átfedéses rangsor (`candidates`) → GLM újrarangsorol a teljes
   ízlés-memóriád alapján, személyes indoklással.
