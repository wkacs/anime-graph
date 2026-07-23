# Komoly onboarding — wizard + oldalankénti túra (2026-07-23)

**Cél:** új user sose essen üres appba; az első 2 percben lista + AI-profil + push, utána a fő funkciókat az adott oldal első látogatásakor mutatjuk meg (nem egyben).

## 1. Wizard — `/onboarding` (kliens-oldal, védett)

Belépési pontok: sikeres regisztráció után automatikus redirect; az üres-lista `OnboardingCTA` „Vezess végig" linkje; Beállítások „Onboarding újraindítása" gomb.

Lépések (előre-hátra léptethető, minden lépésen „Kihagyom"):
1. **Lista** — két fül:
   - *Import*: meglévő AniList-username + MAL-XML flow (`/api/import/*` újrahasznosítva).
   - *„Nincs listám"*: seed-picker — a katalógus népszerű címeinek rácsa, klikk = kiválaszt (mentéskor `completed`), **minimum 5** a továbblépéshez ezen az ágon.
   - **Kihagyás-megerősítő**: „Biztos? Enélkül az ajánló és a gráf üres marad — a szezon-naptár enélkül is működik."
2. **AI-profil-reveal** — POST `/api/profile`, portré + badge-ek inline (lista nélkül a lépés kimarad).
3. **Push-engedély** — meglévő `PushToggle`.
4. **Kész** — `onboardingDone` flag a `settings`-be (szerveroldali → több eszközön is tudott), redirect `/?tour=1` → News-túra azonnal indul.

## 2. Oldalankénti túra — `TourSpotlight`

Saját komponens, lib nélkül: dim-overlay spotlight-kivágással (fixed div a cél-elem rect-jén, óriás `box-shadow` a sötétítés), mellette glass-tooltip, „Tovább / Kihagyom". Cél-elemek `data-tour="<id>"` attribútummal. Első látogatáskor indul, oldalankénti `localStorage`-kulccsal (`tour:<page>`); a News-on a `?tour=1` query is indítja.

Megállók:
- **News**: szezon-rács (ízlés-pontszámok) → „Ajánlj nekem" → TonightPicker
- **Gráf**: buborék-nézet → drill-down → WASD-repülés (a régi hint-overlay-t kiváltja)
- **Böngésző**: kereső → „Neked való?" fit-badge
- **Címoldal**: vélemény-mező („ebből tanul az AI") → fit-badge

## 3. Adat/API

- `settings` kulcs: `onboarding` → `{ done: true }` (meglévő key/value tábla, meglévő settings-API bővítése).
- Seed-picker forrás: meglévő katalógus-lekérdezés (top címek AniList-score/popularity szerint); hozzáadás a meglévő `POST /api/anime` (titleId) végponton.
- Új tábla, új migráció NEM kell.

## 4. Teszt

- Pure helperek unit-tesztje: wizard-léptetés (skip-ágak, seed-minimum), tooltip-pozíció számítás, túra-állapot (storage-kulcs logika).
- Élő smoke: friss user végigmegy a wizardon (seed-ág), News-túra elindul, Gráf/Böngésző/Címoldal első látogatásra hozza a magáét.

## Nem-célok

- Nincs kényszerített, oldalakon átívelő egyben-túra (user döntés: oldalanként, első látogatáskor).
- Nincs túra-lib függőség.
- A wizard nem kötelező — de a kihagyás rákérdez.
