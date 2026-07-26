# Gate A — Kapunyitás (nyílt regisztráció, email, i18n, profil)

*Spec, 2026-07-26. Állapot: jóváhagyva, implementációs terv következik.*

## 1. Miért ez az első

A projekt ma publikus katalógust szolgál ki (133 840 indexelhető URL), de **regisztrálni senki nem tud**: a `/api/auth/register` `INVITE_CODE`-hoz kötött, és kód hiányában 503-mal zár. Amíg ez így van, minden további fejlesztés egyetlen felhasználónak készül.

A második akadály a nyelv: a felület 100%-ban magyar (~229 string 27 `.tsx` fájlban), és 9 AI-modul is hardcode-olja a magyar kimenetet. A célközönség globális.

Ez a spec ezt a két akadályt bontja le, plusz a hozzájuk elkerülhetetlenül tartozó minimumot (email, jelszó-visszaállítás, profil).

### Hely a nagyobb tervben

A teljes cél négy független alrendszerre bomlik, ebben a sorrendben:

| Kör | Tartalom | Állapot |
|---|---|---|
| **A** | Kapunyitás: nyílt reg, email, jelszó-reset, i18n, profil | **ez a spec** |
| **D** | Skála és jog: kép-CDN, sitemap-chunk cache, katalógus-API rate-limit, ToS/DMCA, 18+ kapu | következő |
| **B** | SEO-felület: stúdió-oldalak, karakter/seiyuu katalógus-táblák + sync + oldalak | utána |
| **C** | Közösség: publikus review, follow, activity-feed, like, értesítések, moderáció | utolsó, legnagyobb |

Kifejezetten **kizárva** a teljes irányból: fórum, publikus API, natív mobilalkalmazás.

## 2. Hatókör

### Benne van

- Nyílt regisztráció email-címmel, megerősítő linkkel
- Jelszó-visszaállítás, és vele a session-érvénytelenítés
- Angol alapértelmezett nyelv, magyar váltható, URL változatlan
- Az AI-kimenet nyelve követi a felhasználó nyelvét
- Profil: bio, generált avatar, kitűzött borító mint banner, publikus `/u/[username]` oldal

### Nincs benne

- Captcha (ha spam jön, utólag beköthető, pl. Turnstile)
- OAuth-belépés (Google/Discord)
- Képfeltöltés, moderáció, 18+ kapu (ezek a D és C körök)
- Locale-prefixes útvonalak és hreflang

## 3. Döntések és indoklásuk

| Döntés | Választás | Miért |
|---|---|---|
| Nyelvi felállás | Angol alap, magyar váltható | A célközönség globális |
| URL-szerkezet | Locale **nincs** az URL-ben, cookie dönt | A tartalom (címek, leírások) az AniList-ből amúgy is angol, a magyar verzió nem hozna érdemben más indexelhető oldalt. A `/en` + `/hu` prefix 133k-ról 267k-ra duplázná a sitemapot majdnem azonos oldalakkal, és minden route átépülne |
| i18n-mechanizmus | next-intl, routing nélkül | Hivatalosan támogatott mód pontosan erre az esetre. Többes szám, dátum- és számformázás ingyen jár, szerver- és kliens-komponensben egyaránt. Bevett minta, később bővíthető |
| Regisztráció | Email kötelező + megerősítő link, a fiók azonnal használható | Ez az AniList-modell. A kézbesítés egyetlen hibája ne zárja ki a felhasználót, de a megerősítetlen fiók a C-körben ne írhasson nyilvánosat |
| Profil | Bio + generált avatar + kitűzött borító | Nem kell fájltároló, és nem kell moderáció olyan körben, ahol az még nem épül meg |
| Ízlés-tények nyelve | Abban a nyelvben tárolódik, amiben kinyertük, `lang` oszloppal | A tények **megjelennek** a felületen (TasteCard, ProfileReveal, kezdőlap), nem csak az AI olvassa őket. Az angolra normalizálás azt jelentené, hogy a magyar felhasználó angol tényeket lát a saját kártyáján |

## 4. Adatmodell

### `users` bővítés

Idempotens `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, a `scripts/migrate-*.mjs` mintájára.

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `email` | `text`, nullable | Kisbetűsítve tárolva, unique index rajta. Azért nullable, mert a meglévő `id=1` felhasználónak nincs |
| `email_verified_at` | `timestamp` | `null` = nem megerősített |
| `token_version` | `integer not null default 0` | Session-érvénytelenítés jelszó-resetnél |
| `locale` | `text not null default 'en'` | Eszközök közti nyelvi beállítás |
| `bio` | `text` | Profil |

### Új tábla: `auth_tokens`

| Oszlop | Típus |
|---|---|
| `id` | `serial primary key` |
| `user_id` | `integer not null`, FK `users(id)` `on delete cascade` |
| `kind` | `text not null` — `verify` \| `reset` |
| `token_hash` | `text not null`, unique index |
| `expires_at` | `timestamp not null` |
| `used_at` | `timestamp` |
| `created_at` | `timestamp not null default now()` |

**A nyers tokent soha nem tároljuk**, csak a sha256 hash-ét. A linkben a nyers token utazik, a szerver hash-eli és úgy keres. Így egy adatbázis-szivárgás nem jelent fiók-átvételt.

### `taste_memory` bővítés

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `lang` | `text not null default 'hu'` | A meglévő tények magyarok, ezért ez a default |

### Profilhoz nincs új tábla

A bio a `users`-en ül. Az avatar a felhasználónévből generált szín és monogram, nincs mögötte tárolás. A banner a már létező `pinnedTitles` settings-kulcs első címének borítója. A láthatóság a `settings` kulcs-érték táblában él (`profileVisibility`: `public` \| `private`, új felhasználónál `public`).

### Migráció

A meglévő `id=1` felhasználó email nélkül marad. Belépés után egy sáv kéri be a címet. Amíg nincs email, nincs jelszó-visszaállítás sem — ez tudatos, nem hiba.

## 5. Auth-folyamatok

### Regisztráció-mód

Új környezeti változó: `REGISTRATION_MODE` = `open` \| `invite` \| `closed`, alapértelmezés `open`.

Ma a logika fordított: hiányzó `INVITE_CODE` esetén a regisztráció 503-mal zár. Azért kap explicit változót, hogy a kapu ne egy hiányzó env-től nyíljon ki véletlenül, és hogy bármikor vissza lehessen zárni.

- `open` — bárki regisztrálhat
- `invite` — a `INVITE_CODE` továbbra is kötelező; ha a változó nincs beállítva, a végpont 503-at ad
- `closed` — a végpont 503-at ad, a belépés és a jelszó-visszaállítás változatlanul működik

### Végpontok

**`POST /api/auth/register`** — email, felhasználónév, jelszó.

- Jelszó-minimum 6 karakterről **8**-ra emelve (nyílt regisztrációnál a 6 kevés)
- Rate-limit: IP 5/óra (a meglévő `rate-limit.ts`-szel) és email 3/óra
- Foglalt felhasználónév és foglalt email külön hibaüzenetet ad
- A fiók megerősítetlenül jön létre, a session-cookie azonnal megy, a megerősítő levél utána

**`GET /api/auth/verify?token=`** — hash-alapú keresés, lejárat- és felhasználtság-ellenőrzés, `email_verified_at` beállítása, a token `used_at`-jének kitöltése. Token-élettartam 24 óra.

**`POST /api/auth/verify/resend`** — 3/óra/felhasználó.

**`POST /api/auth/forgot`** — **mindig 200-at ad**, függetlenül attól, hogy létezik-e a cím. Ez szándékos: különben a végpont elárulja, ki regisztrált. Ha a cím létezik, megy a reset-link, 1 órás élettartammal.

**`POST /api/auth/reset`** — token és új jelszó. Jelszó-csere, `token_version++`, a token elhasználva, friss session. **Ez minden más eszközön kilépteti a fiókot.**

### Session-érvénytelenítés

Jelenleg a `verifySession` csak a HMAC-et és a lejáratot ellenőrzi, adatbázist nem olvas, és a session **365 napig** él. Ez ma azt jelenti: ha egy fiókot feltörnek és a tulajdonos jelszót cserél, a támadó tokenje további egy évig érvényes marad.

A megoldás:

- A token payloadja `userId.tokenVersion.exp.hmac` lesz
- A middleware (edge) továbbra is **csak** HMAC-et és lejáratot ellenőriz, adatbázis nélkül, így gyors marad
- A `requireUserId` (az 51 szerver-route közös belépője) egyezteti a `token_version`-t, **process-memóriás cache-sel, 60 másodperces TTL-lel**. Steady state: nulla extra adatbázis-kör. Legrosszabb eset: egy érvénytelenített session még legfeljebb 60 másodpercig él
- A session élettartama 365 napról **30 napra** csökken, csúszó megújítással: ha a `requireUserId` olyan tokent lát, aminek már több mint a fele letelt (15 nap), a válasz friss cookie-t állít be. Így az aktív felhasználó sosem esik ki, az inaktív token viszont 30 nap után lejár

### Email-küldés

Resend, ami már bent van a napi digesthez. `RESEND_API_KEY` nélkül a regisztráció működik, csak a levél marad el és naplózódik, hogy a fejlesztés ne álljon meg a kulcson.

A linkek a `siteUrl()`-lel épülnek. Ez 2026-07-25-ig `http://localhost:3000`-t adott élesben, mert az `APP_URL` hiányzott a Vercel prod-envből; azóta a `VERCEL_PROJECT_PRODUCTION_URL`-re esik vissza, de **az `APP_URL` beállítása továbbra is kötelező**.

## 6. i18n-réteg

### Mechanizmus

next-intl „usage without i18n routing" módban. A locale a `NEXT_LOCALE` cookie-ból jön, fallback `en`, az URL változatlan. Szerver-komponensben `getTranslations()`, kliensben `useTranslations()` egy `NextIntlClientProvider` alatt a root layoutban.

A locale forrása belépve a `users.locale`, anonim látogatónál a cookie, annak hiányában az `Accept-Language`. A nyelvváltó a TopNav-ban és a Beállításokon ül: cookie-t ír, és belépve az adatbázist is.

### Szótár

`messages/en.json` és `messages/hu.json`, namespace-ekre bontva (`nav`, `auth`, `list`, `title`, `settings`, `wrapped` és így tovább). A kulcsok az **angol** forrásból képződnek, nem a magyarból.

### A 27 fájl átvezetése

Ez a kör legnagyobb mechanikus tétele. Fájlonként: string kiemelése, kulcs képzése, a meglévő magyar szöveg a `hu.json`-be, az angol fordítás az `en.json`-be. **Egy fájl egy commit**, hogy követhető maradjon, és egy elrontott kör ne vigyen magával 27 fájlt.

Az API-hibaüzenetek is magyarok (például „Ez a felhasználónév foglalt"), ezek is átvezetendők.

### Az AI kimeneti nyelve

Kilenc modul hardcode-olja a magyar kimenetet: `recommend`, `vibe`, `profile`, `evolution`, `seasonal`, `duo`, `extract`, `nl-search`, plusz egy route. Mindegyik `locale` paramétert kap, és a prompt nyelvi utasítása abból épül.

### AI-cache kulcsok

A `recommendations` tábla (`kind` + `input`) és az `api_cache` (`seasonal-ai:<év>-<szezon>`) nyelvfüggetlenül cache-eli az AI-válaszokat. **A locale-nak be kell mennie a cache-kulcsba**, különben nyelvváltás után a felhasználó a régi nyelvű választ kapja vissza.

## 7. Profil

Ma csak a `/p/[token]` titkos megosztó link létezik. Nyílt regisztráció mellett kell egy stabil, saját cím: **`/u/[username]`**. A `/p/[token]` marad annak, ami: nem listázott megosztó link.

Tartalom: monogram-avatar, bio, kitűzött címek (a `PinnedShowcase` már kész), alap-statisztikák, és belépett nézőnek kompatibilitás-chip (a `CompatChip` már kész). Nagyrészt a meglévő `/p` komponensek újrahasznosítása.

Láthatóság: `profileVisibility` settings-kulcs, új felhasználónál `public`, kapcsoló a Beállításokon. Privátra állítva a `/u/[username]` **404-et ad** (nem 403-at: a 403 elárulná, hogy a felhasználónév létezik). A saját profilját a tulajdonos privát módban is látja. **A vélemények nyers szövege továbbra sem megy ki publikusan** — ez a `/p` mai szabálya, és invariáns marad.

A profil-oldalak **nem kerülnek a sitemapba** ebben a körben, és `noindex`-et kapnak. Üres profilokból tízezret indexeltetni ártana.

## 8. Tesztelés

A repó 283 adatbázis-mentes vitest tesztje a minta, az újak is ilyenek:

- `auth-token.ts` — token generálás, hash, lejárat, egyszer-használat
- `locale.ts` — feloldás cookie, felhasználói beállítás és `Accept-Language` sorrendből
- Session `tokenVersion` egyeztetés és a memória-cache TTL-je
- Regisztráció-validáció: email-formátum, felhasználónév-minta, jelszó-hossz
- A nyelvváltás ne adjon vissza más nyelvű, cache-elt AI-választ

A mail-küldés kulcs nélkül no-op, teszt alatt mockolva.

**Kötelező záró lépés a `next build` + `next start` smoke.** A 2026-07-25-i ISR-hiba pontosan azért élt túl egy deployt, mert dev alatt nem látszott. A meglévő `src/lib/isr-db-client.test.ts` őrszem-teszt is fenntartandó.

## 9. Elfogadási kritériumok

1. Idegen böngészőből: regisztráció, megerősítő levél, verify-link, belépett és megerősített fiók
2. Elfelejtett jelszó, levél, reset, és az összes korábbi session kilépett
3. A nyelvváltó mindkét irányban működik, az AI a választott nyelven válaszol, és a cache nem szivárog át nyelvek között
4. `/u/[username]` publikus profil elérhető, privátra állítva 404-et ad, vélemény-szöveg sehol nem szivárog ki
5. Minden teszt, `tsc`, `eslint`, prod-build és `next start` smoke zöld

## 10. Deploy-teendők

- Új Vercel env: `REGISTRATION_MODE=open`, `RESEND_API_KEY`, `FROM_EMAIL`
- Meglévő, de hiányzó env: **`APP_URL`** (enélkül a verify- és reset-linkek rossz domainre mutatnak)
- Adatbázis-migráció backuppal, a `scripts/` mintája szerint: `users` bővítés, `auth_tokens` létrehozás, `taste_memory.lang`
- A `INVITE_CODE` maradhat a helyén, `invite` módra váltáshoz kell

## 11. Kockázatok

| Kockázat | Kezelés |
|---|---|
| Spam-fiókok nyitás után | IP- és email-rate-limit, kötelező megerősítés. Ha kevés, Turnstile utólag |
| Mail-kézbesítés hibája kizárja a felhasználót | A fiók megerősítés nélkül is használható, az újraküldés külön végpont |
| A 27 fájlos i18n-átvezetés félbemarad | Fájlonkénti commit, a tesztek végig zöldek maradnak |
| Vegyes nyelvű ízlés-memória | Tudatosan vállalt: a `lang` oszlop jelöli, a nyelvi modell vegyes bemenetet is olvas |
| A `token_version` cache miatt 60 mp-ig él egy érvénytelenített session | Vállalt kompromisszum a kérésenkénti adatbázis-olvasás helyett |

## 12. Végrehajtási sorrend

A kör három, egymásra épülő szakaszra bomlik. Mindegyik önmagában zöld tesztekkel és működő appal zárul, tehát félbehagyható:

1. **Auth** — adatbázis-migráció, `auth_tokens`, regisztráció-mód, verify, forgot, reset, session-érvénytelenítés. A végén a kapu nyitható.
2. **i18n** — next-intl beállítás, szótárak, a 27 fájl átvezetése fájlonkénti commitokkal, az AI-promptok locale-paramétere, a cache-kulcsok bővítése.
3. **Profil** — `bio`, monogram-avatar, `/u/[username]`, láthatóság-kapcsoló.

Az i18n a leghosszabb, de a legkevésbé kockázatos szakasz; az auth a legrövidebb, de ott van a biztonsági felület, ezért az megy előre.
