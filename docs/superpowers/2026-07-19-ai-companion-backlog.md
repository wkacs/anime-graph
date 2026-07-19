# AI-native companion backlog — 2026-07-19

Cél: a legjobb AI-native anime-companion. Nem több AI-gomb — a rendszer folyamatosan
tanul a userről, kíséri nézés közben, és magától szól. Pozíció: „Letterboxd for anime",
MAL/AniList MELLETT él (sync), taste/discovery-élményben veri őket.

Javasolt sorrend: **1 → 7 → 3 → 4 → 2 → 6 → 5** (a 7-es a user saját kérése, előre véve).

## 1. Mélyebb ízlés-modell (legnagyobb hatás)

- **Implicit jelek**: az `episode_log`-ból nézési ütem — mit darál le 2 nap alatt,
  mit húz hónapokig. Erősebb jel minden kimondottnál, az adat MÁR GYŰLIK.
- **Mikro-vélemény**: epizód +1 után 1 kattintás (🔥/😐/💤 + opcionális fél mondat)
  → folyamatos taste-tanulás, nem csak befejezéskor.
- **Embedding-réteg**: Neon pgvector — anime-leírások + vélemények vektorban,
  hasonlóság-keresés a mostani tag-átfedéses rangsor helyett/mellett.
- Időbeli súlyozás: friss ízlés-tény > régi (a korszak-feature már látja a változást).

## 2. Nézés-kísérő

- **Spoiler-safe recap**: a progress ismert → „mi történt eddig", „ki ez a karakter?"
  a user saját epizódjáig bezárólag.
- „Megéri folytatni?" droppont-tanács (saját ízlés + ismert score-görbe).

## 3. Proaktivitás

- A `anime_staff` tábla kész → **„kedvenc rendeződ új animét jelentett be"**,
  „2. évad bejelentve" push.
- Heti személyes digest PUSH-ban (digest + push-infra megvan, összekötni).
- „Rég nem néztél — ma estére egy 20 perces?" inaktivitás-ajánlat.

## 4. Bizalom + kontroll

- **Ízlés-profil oldal**: mit hisz a rendszer a userről, tényenként
  szerkeszthető/törölhető; „nem igaz" gomb ajánlásoknál → memória-korrekció.

## 5. Kontextus-kérdezés ⚠️ NYITOTT DÖNTÉS

- Anime-oldalba ágyazott „kérdezz erről" (spoiler-safe, listád-tudó).
- ⚠️ A user korábban (2026-07-19 feature-batch) az AI-chatet ELUTASÍTOTTA —
  ez nem külön chat-fül lenne, de user-döntés kell, mielőtt bármi épül.

## 6. Modell-infra

- GLM flash flaky + gyenge a mély feladatokhoz → **BYOK** (saját OpenRouter/egyéb
  kulcs a Beállításokban) + modell-választó; GLM marad ingyen-alap.
- Embedding-hez olcsó dedikált modell.

## 7. Vélemény-fül (USER KÉRÉSE 2026-07-19 este)

- Új fül/nézet, ami **feldobja azokat az animéket, amikhez még nincs vélemény**,
  és kéri a usert, hogy írjon — cél: MINDEN listaelemhez legyen ízlés-tény.
- Okos sorrend: előbb a magas pontszámú / nemrég befejezett / sokat nézett címek
  (ott a legfrissebb az emlék, ott ér a legtöbbet a kivonat).
- Gamification-jelleg: haladás-számláló („34/258 animédnek van véleménye"),
  gyors-mód: egy kártya = egy vélemény-mező, mentés után jön a következő.
- Ez tölti az 1-es pont taste-modelljét — ezért kerül előre a sorrendben.

## Versenyhelyzet-kontextus (2026-07-19 beszélgetés)

MAL/AniList várfalai: kanonikus adatbázis + network effect — frontálisan nem érhető
utol. Nyilvános termékhez később kell: angol i18n, saját metadata-tükör (AniList
rate limit 90 req/min), kétirányú AniList/MAL sync, nyílt reg (email-verify, OAuth),
publikus profilok/social, AI-költségmodell (freemium/BYOK), AniList ToS-check.
