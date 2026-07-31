# Production élesítési runbook

Ez a projekt kézi Vercel Dashboard-beállítást feltételez. A runbook nem igényel
és nem használ Vercel CLI-t.

## 1. Adatbázis

Készíts mentést vagy Neon branchet, majd azon ellenőrizd az idempotens migrációkat:

```powershell
$env:DATABASE_URL = 'postgres://...'
node scripts/migrate-gate-a.mjs
node scripts/migrate-taste-signal.mjs
node scripts/migrate-watchlist-ownership.mjs
node scripts/migrate-adult-content.mjs
# A régi, nyers rate-limit azonosítók miatt az első új deploy előtt egyszer:
node scripts/migrate-rate-limit-privacy.mjs
node scripts/verify-catalog-split.mjs
```

Ezután szükség szerint futtasd a katalógus-adatláncot:

```powershell
node scripts/import-offline-db.mjs
node scripts/backfill-descriptions.mjs --only-missing
node scripts/sync-title-recs.mjs
node scripts/recompute-scores.mjs
```

Csak sikeres ellenőrzés után ismételd meg a production adatbázison.

## 2. Resend és DNS

1. Adj hozzá külön küldő aldomaint a Resendben, például `mail.example.com`.
2. Másold be a Resend által adott SPF és DKIM rekordokat a DNS-kezelőbe.
3. Állíts be DMARC rekordot a domain szabályaihoz illően.
4. Hozz létre csak küldésre jogosult API-kulcsot.
5. A `FROM_EMAIL` legyen például `Anime Graph <hello@mail.example.com>`.
6. Ellenőrizd a domain „verified” állapotát, majd küldj tesztlevelet.

Az auth-leveleknél érdemes kikapcsolni a click/open trackinget.

## 3. Vercel Dashboard környezeti változók

Kötelező production értékek:

| Változó | Követelmény |
|---|---|
| `DATABASE_URL` | production Neon connection string |
| `GLM_API_KEY` | elsődleges AI-kulcs |
| `SESSION_SECRET` | legalább 32 karakter, csak productionre |
| `REGISTRATION_MODE` | induláskor ajánlott `invite` |
| `INVITE_CODE` | `invite` módban kötelező |
| `AI_GLOBAL_DAILY_LIMIT` | pozitív egész napi összplafon |
| `RESEND_API_KEY` | küldésre korlátozott production kulcs |
| `FROM_EMAIL` | ellenőrzött küldő domain |
| `CRON_SECRET` | legalább 32 karakter, random |
| `APP_URL` | stabil `https://` origin |
| `NEXT_PUBLIC_OPERATOR_NAME` | valós üzemeltető |
| `NEXT_PUBLIC_OPERATOR_ADDRESS` | valós cím |
| `NEXT_PUBLIC_OPERATOR_EMAIL` | kapcsolati cím |

Funkciófüggő értékek: `NOTIFY_EMAIL`, VAPID kulcsok, MAL/AniList OAuth adatok,
`OAUTH_TOKEN_ENCRYPTION_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SENTRY_DSN`.

Ha MAL vagy AniList kétirányú OAuth-szinkront kapcsolsz be, a kliensazonosítót
és titkot mindig párban add meg, majd készíts stabil, 32 bájtos titkosítókulcsot:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Az eredményt csak `OAUTH_TOKEN_ENCRYPTION_KEY` secretként tárold. Meglévő
`sync_accounts` soroknál ugyanazzal a kulccsal egyszer futtasd:

```powershell
node scripts/migrate-oauth-token-encryption.mjs
```

A kulcs elvesztése a kapcsolt tokeneket használhatatlanná teszi; rotáció előtt
előbb vissza kell fejteni és az új kulccsal újratitkosítani őket.

A production build automatikusan futtatja a környezeti validátort. Ugyanez
kézzel is ellenőrizhető olyan shellben, ahol az éles env már be van töltve:

```powershell
$env:VALIDATE_PRODUCTION_ENV = '1'
node scripts/validate-production-env.mjs
```

## 4. GitHub Actions secretek

- `APP_URL`
- `CRON_SECRET` – ugyanaz, mint a Vercel production érték
- `DATABASE_URL` – csak a katalógus-karbantartó workflow-khoz

A katalógus és a heti offline sync közös concurrency groupban fut, ezért nem
írják egyszerre ugyanazokat a táblákat.

A `catalog-full-sync` workflow kézi karbantartásra való; ne adj hozzá napi
ütemezést, mert a Vercel `sync-catalog` cron végzi az inkrementális frissítést.

## 5. Deploy előtti ellenőrzés

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

Ellenőrizd, hogy nincs gitben `.env*`, API-kulcs vagy connection string.

## 6. Production smoke

1. `/api/health` 200.
2. Regisztráció → verify levél → link egyszer működik, másodszor érvénytelen.
3. Forgot/reset → új jelszó; a korábbi sessionök megszűnnek.
4. Nem megerősített fiók AI-hívása elutasított.
5. Új profil 404-et ad publikus URL-en, amíg explicit publicra nem állítják.
6. Privát user nem látható feedben, review-ban, compare/duo/group funkcióban.
7. Felnőtt cím nem jelenik meg publikus/közösségi felületen.
8. MAL/AniList import, listaírás és ajánló működik.
9. Push engedély és egy tesztkézbesítés működik HTTPS-en.
10. A három Vercel cron következő futása és az óránkénti GitHub cron zöld.

Az első publikus napokban maradjon `REGISTRATION_MODE=invite`. Nyílt módra csak
a kézbesítés, költségplafon, logfigyelés és visszaállítási folyamat igazolt
működése után válts.

## 7. Visszaállítás

Hibás deploynál állítsd vissza az előző stabil deploymentet a Vercel
Dashboardon, és szükség esetén válts `REGISTRATION_MODE=closed` módra. Ne
futtass destruktív adatbázis-visszaállítást ellenőrzött mentés és pontos
incidenshatókör nélkül.
