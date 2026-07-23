# Differenciáló-backlog — „több mint MAL/AniList" (2026-07-23)

**Pozicionálás egy mondatban:** MAL/AniList = jegyzetfüzet az animéidről. Anime-graph = **agy, ami ismeri az ízlésed és dönt helyetted.**

A MAL/AniList ereje az adatbázis + közösség (ott nem verjük meg őket). A gyengéjük: a lista náluk halott archívum — nem segít dönteni, nem érti az ízlést, nem ad vissza semmit. Ez a rés, erre épül minden alábbi tétel.

## A landing page három érve (miért váltanának)

1. „A listád eddig csak tárolt. Mostantól **dolgozik neked**." (ajánló, tonight-picker, digest, szezon-radar)
2. „Importálsz, és az AI **elmondja, ki vagy animében** — 30 másodperc alatt." (wow-onboarding + identitás)
3. „Nem kell váltanod. **Szinkronban tartjuk a MAL-od.**" (nulla kockázat, nincs lock-in)

## Meglévő wedge (élezni, nem újat építeni)

- **Taste-memory** — szabad szöveges véleményből AI-kivonat; a rendszer tudja, MIÉRT szeretsz valamit. Egyik versenytárs sem modellez ízlést.
- **Döntés-motor** — TonightPicker, duo-ajánló, személyre szabott szezon-radar. A „mit nézzek ma este 40 percben kettesben" kérdésre náluk nincs válasz, nálunk egy gomb.
- **3D gráf + idővonal + Wrapped** — az anime-életed mint felfedezhető tér és megosztható identitás-tárgy.
- **Duel/Elo** — pontozás szám nélkül: jobb adat, mint az 1-10, és játék.

## Backlog (prioritás-sorrendben, M-roadmaphez illesztve)

### D1. Fit-score a publikus katalógus-oldalakon (M2c-vel együtt) — KONVERZIÓS GÉP
Minden `/anime|manga/[slug]` oldalon badge: „87% egyezés az ízléseddel" (bejelentkezve valós érték, kijelentkezve teaser → „jelentkezz be"). A SEO-oldal így nem Wikipédia-másolat, hanem regisztráció-motor: Google-ből jön a látogató, a fit-score miatt marad.
- Alap: taste_memory + title genre/tag → egyszerű súlyozott egyezés-score (lokális, AI nélkül is megy; GLM-magyarázat prémium).
- Scope: `lib/fit-score.ts` (pure, tesztelhető) + kliens-oldali OwnerOverlay-be badge (ISR-cache nem sérül).

### D2. Onboarding-ízlésprofil — AZ ELSŐ 2 PERC WOW-JA
Import (MAL XML / AniList username — MEGVAN) után azonnal: AI megírja az ízlés-profilt („A lassú égésű pszichológiai drámák embere vagy, de titkos gyengéd a sport-anime…") + 5 találó ajánlás.
- Kód nagy része megvan: `profile.ts` (kind=profile cache) + recommend-pipeline. Hiányzik: import-flow végére kötés + dedikált „profilod elkészült" képernyő.

### D3. Kétirányú MAL/AniList-szinkron — VÁLTÁSI-KÖLTSÉG-GYILKOS
Nem „válts", hanem „tükrözz": nálunk él az agy, a MAL/AniList-lista automatikusan frissül vissza (státusz/progress/pont írás MAL API v2 / AniList mutation, OAuth per user). A user párhuzamosan használja, amíg a miénk nyer.
- Import már van; a visszaírás a hiányzó fél. OAuth-app-regisztráció kell (MAL client id, AniList client id).
- M3 táján (auth-keményítéssel együtt).

### D4. Ízlés-kompatibilitás % profilok közt (M4 social mellé)
A VS/duo-ajánlóból egy lépés: publikus profilon kompatibilitás-badge a bejelentkezett nézővel. „Közös nézéshez társkereső" — klubok, Discord-közösségek behúzója.

### D5. Csoportos döntő („mit nézzen a klub")
N ember taste-memory metszete → közös ajánlás. A duo-ajánló általánosítása. Discord-botként terítve ingyen disztribúció (M6+).

### D6. Spoiler-mentes „mit mondanak a hozzád hasonlók"
Review-k AI-összegzése ízlés-szomszédok szerint súlyozva, spoiler-szűréssel. (M4 review-rendszer UTÁN van értelme — előfeltétele a saját review-korpusz.)

### D7. Drop-előrejelző
„Ezt valószínűleg a 4. résznél dobnád" — taste_memory + dropped-lista + tag-minta. Senki nem meri, memorábilis marketing-tulajdonság.

### D8. Időkapszula / nosztalgia-push
„5 éve ma fejezted be a Steins;Gate-et — újranéznéd?" watchedAt-ból, a meglévő push-infrastruktúrán. Visszatérés-motor, olcsó.

## Sorrend

D1 (M2c-vel) → D2 (kód 80% megvan) → D3 (M3) → D4+D5 (M4) → D7, D8 (kitöltő, bármikor) → D6 (M4 után).
