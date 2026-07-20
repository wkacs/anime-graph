# News-oldal szezon-rács átláthatóság — 2026-07-20

## Probléma

A News (főoldal) „A szezon" szekciója 25 kártyát mutat egyenrangúan, AniList
népszerűség-sorrendből adásidő szerint rendezve. Nincs se szűrés, se ízlés-alapú
rangsor — a user szerint zajos, nem lehet benne eligazodni.

**Gyökér-ok (kód-lelet 2026-07-20):** a `kind='seasonal'` recommendations-rekordot
SENKI nem írja a kódban. Két helyen olvassuk (`api/news/route.ts` `cachedSeasonScores`,
`api/digest/route.ts`), mindkettő mindig üres eredményt kap. Ezért a szezon-kártyák
`tasteScore`-ja mindig `null`, a badge sosem jelenik meg, és a napi digest szezon-tippje
is néma. Nem UI-hiba: hiányzó backend.

## Döntés

Két rész, egy körben:

1. **Ízlés-pont mindig legyen** — a jelenlegi szezon összes címére, automatikusan,
   cache-elve.
2. **Rendezés + szűrő sáv** a szezon-rács fölé.

Elvetve (user-döntés): bucket-csoportosítás, „csak top 6 + kinyitó", „nincs a
listámon" kapcsoló.

## 1. Backend — `GET /api/news/season-scores`

Az `api/news/upcoming/route.ts` bevált mintáját tükrözi, de a **jelenlegi** szezonra:

- Cache-kulcs: `kind = seasonal-ai:${year}-${season}` a `recommendations` táblában.
  Nem ütközik az upcoming kulcsával, mert ott `nextSeason()` szerepel — más a
  szezon/év pár.
- **Mind a szezon-címet pontozza** (jelenleg 25 db, `fetchSeason` `perPage: 25`),
  nem `rankCandidates`-szel szűkít, hogy minden kártyán legyen pont.
  A `seasonScoresSchema` max 30 elemet enged — belefér egy GLM-hívásba.
- 7 napos pozitív cache, 1 órás negatív cache (`{ items: [], failed: true }`),
  `consumeAiQuota(userId)` a hívás előtt — a napi AI-keret nem ég el News-betöltésre.
- Válasz: `{ season, items: [{ anilistId, score, reason }], cached }`.
- A már listán lévő címeket is pontozza (a kártya külön jelöli, hogy „listádon").

Kapcsolódó javítás: a `digest/route.ts` halott `kind='seasonal'` olvasása erre az új
kulcsra áll át, így a napi digest szezon-tippje is életre kel.

A `/api/news` marad gyors: szezon-kártyák pont nélkül jönnek, a pont külön csatornán
úszik be (mint a digest ma). A route-ból a halott `cachedSeasonScores` kikerül.

## 2. Frontend — szűrő-sáv

**Logika:** `src/lib/season-filter.ts` — tiszta, UI-mentes, tesztelhető függvények.

- `applySeasonView(items, view)` → szűrt + rendezett lista
- `seasonFacets(items)` → a szezonban ténylegesen előforduló műfajok / formátumok /
  streaming-szolgáltatók (a sáv ebből épül, nem beégetett listából)

**Rendezés** (`view.sort`):

| érték | jelentés |
|---|---|
| `taste` | ízlés-pont ▼ — **alapértelmezett**; a pont nélküliek a végén |
| `airing` | következő adás ideje ▲ (a mai szerver-oldali rendezés) |
| `score` | AniList-átlag ▼ |
| `popularity` | AniList eredeti sorrendje (a lista beérkezési indexe) |

**Szűrők** (dimenziók közt AND, dimenzión belül OR):

- műfaj-chipek (több választható)
- formátum: TV / Movie / ONA / OVA / Special
- streaming-szolgáltató
- minimális ízlés-pont: 0 / 50 / 60 / 70 / 80

**Komponens:** `src/components/SeasonFilterBar.tsx` — a szekció-cím alatt, találat-
számlálóval („12 / 25"). Szűrő-állapot lokális React state, nem URL-query.

## Hibakezelés

- Pont-fetch bukik vagy kvóta elfogy → a rács él tovább pont nélkül, a rendezés
  `airing`-re esik vissza, a sáv jelzi: „AI-pont most nem elérhető".
- A min-pont csúszka pont nélküli állapotban ki van kapcsolva (különben mindent kiszűrne).

## Teszt

`src/lib/season-filter.test.ts`:

- ízlés-pont rendezés: null-ok a végére kerülnek, nem előre
- több-dimenziós szűrés: műfaj ∩ formátum ∩ streaming ∩ min-pont
- egy dimenzión belül több érték = OR
- üres eredmény esetén nem dob
- `seasonFacets` csak létező értékeket ad vissza, duplikátum nélkül, rendezve
