# Üzemeltetés

## Ütemezett feladatok

A Vercel production deploy a `vercel.json` alapján három napi cront regisztrál.
Az időpontok UTC-ben értendők; Hobby csomagon a napi futás az adott órán belül
nem másodperc-pontos.

| Útvonal | Ütemezés | Feladat |
|---|---:|---|
| `/api/cron/sync-catalog` | 04:00 UTC | AniList inkrementális ANIME és MANGA katalógusfrissítés |
| `/api/cron/airing-digest` | 06:00 UTC | opcionális napi admin e-mail a `NOTIFY_EMAIL` címre |
| `/api/cron/time-capsule` | 07:00 UTC | évforduló- és szezonkezdő web push |

Az óránkénti `/api/cron/airing-check` hívást a
`.github/workflows/airing-cron.yml` végzi. Publikus GitHub-repóban a hosszú
inaktivitás miatt letiltott scheduled workflow-t kézzel újra kell engedélyezni.

Minden végpont `Authorization: Bearer $CRON_SECRET` fejlécet vár. Hiányzó
server secret HTTP 500, hibás fejléc HTTP 401. Átmeneti AniList, Resend vagy
push hiba 5xx választ ad, hogy a futás ne látszódjon hamisan sikeresnek.

### Kézbesítési deduplikáció

- A Resend digest determinisztikus, 24 órás idempotenciakulcsot használ.
- A push címzettenként `pending`/`sent` állapotot tárol az `api_cache` táblában.
- Friss `pending` claimet másik futás nem vesz át; 15 perc után újrapróbálható.
- Halott push endpoint (404/410) automatikusan törlődik.
- Az epizód globális dedupja csak az összes címzett lezárása után készül el.

A `.github/workflows/catalog.yml` szándékosan csak kézzel indítható teljes
ANIME/MANGA-szinkron. A napi frissítést a fenti inkrementális Vercel cron végzi;
a kettőt ne ütemezd ugyanarra a katalógusra.

## Resend

Production előtt:

1. használj külön küldő aldomaint;
2. állítsd be és ellenőrizd az SPF/DKIM rekordokat, valamint ajánlott a DMARC;
3. a kulcs csak küldési jogosultságot kapjon;
4. a `FROM_EMAIL` ellenőrzött domainről jöjjön, emberileg olvasható névvel;
5. próbáld végig a regisztráció, újraküldés, forgot/reset és digest folyamatot.

A kód HTML és plain-text részt küld, 10 másodperces timeoutot használ, és a
logokban nem írja ki a címzettet. Auth-levél hibája productionben nem marad
figyelmen kívül.

## Hibafigyelés

- `GET /api/health`: adatbázist is ellenőrző uptime végpont.
- Szerveroldali hibák: platform function logok.
- Klienshibák: `POST /api/monitor`; opcionális `SENTRY_DSN` esetén továbbítás.
- A cronoknál a HTTP státuszt és a válasz `failed`/`pending` mezőit is figyeld.

Riasztást érdemes legalább az ismétlődő 5xx cronokra, a regisztrációs
levélhibákra és az AI globális limit közelítésére beállítani.

## Kulcsrotáció

- `SESSION_SECRET` rotáció minden aktív sessiont érvénytelenít.
- `CRON_SECRET` rotációt egyszerre vezesd át a Vercel envben és a GitHub
  Actions secretben.
- Resend/AI/OAuth kulcs kompromittálódásakor először vond vissza a régi kulcsot,
  majd add meg az újat és indíts új production deployt.

## Jogi adatok

A jogi oldalak a következő build-time változókat használják:

```text
NEXT_PUBLIC_OPERATOR_NAME
NEXT_PUBLIC_OPERATOR_ADDRESS
NEXT_PUBLIC_OPERATOR_REGISTRATION   # opcionális
NEXT_PUBLIC_OPERATOR_EMAIL
```

A kötelező mezők nélkül production build nem készülhet, így TODO-adat nem
kerülhet véletlenül éles oldalra.
