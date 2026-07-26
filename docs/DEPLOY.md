# Élesítés-runbook (Vercel + Neon + GitHub cron)

Állapot 2026-07-23: master==origin, prod build zöld, DDL-migrációk (ai-tier, catalog-cache) lefutottak a Neonon, adat-lánc (offline-db import → backfill → recs → recompute) folyamatban.

## 0/a. Gate-A migráció (2026-07-26)

A nyílt regisztráció sémája: `DATABASE_URL="<prod>" node scripts/migrate-gate-a.mjs`
(idempotens, additív; a futó régi kód nem törik tőle). Ez adja a `users` új oszlopait
(`email`, `email_verified_at`, `token_version`, `locale`, `bio`), az `auth_tokens`
táblát és a `taste_memory.lang` mezőt.

🔴 A deploy után **mindenki egyszer kilép**: a session-token formátuma
`uid.exp.hmac`-ról `uid.ver.exp.hmac`-ra váltott, a régi sütik érvénytelenek.

## 0/b. Ízlés-jel migráció (2026-07-26)

`DATABASE_URL="<prod>" node scripts/migrate-taste-signal.mjs` — a `taste_signal` tábla
(additív, idempotens). Utána egyszer: `node scripts/backfill-taste-signals.mjs`.

A backfill AI nélkül dolgozik, és a jelenlegi adaton **nulla jelet talált** (a tények
magyar prózában vannak, az AniList tagnevei angolul). A valódi jelek az új vélemények
`extract`-jéből jönnek — a lokális rangsor addig is a viselkedési vektorral működik.

## 0. Előfeltétel — DB-adatlánc kész

A deploy előtt fusson végig: `import-offline-db.mjs` → `backfill-descriptions.mjs --only-missing` → `sync-title-recs.mjs` → `recompute-scores.mjs`, majd app-smoke. Amíg nincs kész, a recommend/browse kevés jelöltet ad (502 „nincs elég katalógus-adat", nem crash).

## 1. Vercel-projekt (kézzel, webes UI — a gépen a CLI a CÉGES fiókkal van belépve, azt NE használd!)

1. vercel.com → **wkacs személyes fiók** → Add New Project → Import a `wkacs/anime-graph` GitHub-repóból.
2. Framework: Next.js (auto). Build-parancs default.
3. Environment Variables (Production):

| Változó | Kötelező | Érték/megjegyzés |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon connection string (ugyanaz, ami .env.local-ban) |
| `GLM_API_KEY` | ✅ | open.bigmodel.cn kulcs |
| `SESSION_SECRET` | ✅ | ÚJ hosszú random string prodra (ne a dev-értéket) |
| `REGISTRATION_MODE` | ✅ | `open` \| `invite` \| `closed`. Nyílt regisztrációhoz `open`. Ismeretlen érték = `closed` |
| `INVITE_CODE` | – | csak `REGISTRATION_MODE=invite` esetén kell |
| `FROM_EMAIL` | ✅ | a rendszer-levelek feladója (megerősítés, jelszó-reset) |
| `CRON_SECRET` | ✅ (cronhoz) | random string; a Vercel-cron és a GH-cron is ezt küldi |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | push-hoz | .env.local-ban generálva van |
| `VAPID_PRIVATE_KEY` | push-hoz | .env.local-ból |
| `VAPID_SUBJECT` | push-hoz | `mailto:...` |
| `AI_DAILY_LIMIT` | – | opcionális, default 20 (tier-limitek az `ai-limits.ts`-ben) |
| `OPENROUTER_API_KEY` | – | GLM-429 failover |
| `RESEND_API_KEY`, `NOTIFY_EMAIL`, `FROM_EMAIL` | – | napi e-mail digest |
| `APP_URL` | ✅ | a prod URL (pl. `https://anime-graph.vercel.app`). **Enélkül a sitemap/robots/canonical/JSON-LD localhost-URL-eket ad ki** (a kód a `VERCEL_PROJECT_PRODUCTION_URL`-re esik vissza, de az OAuth-callbackek ettől még ezt olvassák) |
| `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET` | – | kétirányú MAL-szinkron (myanimelist.net/apiconfig, redirect: `<APP_URL>/api/sync/mal/callback`) |
| `ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET` | – | kétirányú AniList-szinkron (anilist.co/settings/developer, redirect: `<APP_URL>/api/sync/anilist/callback`) |

4. Deploy. A `vercel.json` cron (06:00 UTC napi e-mail) automatikusan él.

## 2. GitHub repo-secretek (Actions-cronokhoz)

`Settings → Secrets and variables → Actions`:

- `CRON_SECRET` — ugyanaz, mint a Vercel env
- `APP_URL` — a prod URL (pl. `https://anime-graph.vercel.app`) → `airing-cron.yml` (óránkénti push)
- `DATABASE_URL` — a Neon string → `catalog.yml` (nightly sync+recompute) és `offline-db-sync.yml` (heti)

## 3. Deploy utáni teendők (egyszeri)

1. **kacs → paid tier** (különben 5 recommend/nap limit): `UPDATE users SET tier='paid' WHERE id=1;`
2. `demo` teszt-user törlése, ha nem kell: `DELETE FROM users WHERE id=2 AND username='demo';` (+ user_title sorai kaszkád/kézzel)
3. Smoke élesben: login (kacs) → News betölt → Lista (271 cím) → add-flow (keresés→hozzáadás) → Recommend me → vibe → publikus `/p/[token]` → push-engedély (HTTPS-en már működik).
4. Regisztráció-teszt az új INVITE_CODE-dal (majd a kód megosztása csak meghívottaknak).

## Gotchák

- Neon HTTP-cache: `fetchOptions: { cache: 'no-store' }` már a kódban.
- A scriptek `process.env.DATABASE_URL`-t olvasnak (NEM .env.local-t) — GH-cronban a secret adja.
- `next build`+`next dev` közös `.next` → lokális buildnél dev-server le.
- Web-push localhoston nem megy, prod HTTPS-en igen.
