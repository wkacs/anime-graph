# Üzemeltetés — cron, hibafigyelés, env

## Cron (Vercel, Hobby-terv: max 2 slot, napi futás)

A `vercel.json` két cront regisztrál — a Vercel automatikusan
`Authorization: Bearer $CRON_SECRET` fejléccel hív, ha a `CRON_SECRET` env be van állítva:

| Slot | Útvonal | Mikor | Mit csinál |
|---|---|---|---|
| 1 | `/api/cron/sync-catalog` | 04:00 UTC | inkrementális katalógus-sync: az AniList-en tegnap óta módosult címek (UPDATED_AT_DESC + vízjel az `api_cache`-ben) |
| 2 | `/api/cron/daily` | 06:00 UTC | gyűjtő: `/api/cron/airing-check?mode=email` (napi e-mail digest) + `/api/cron/time-capsule` (évforduló- és szezon-push) |

- **Kell:** `CRON_SECRET` env a Vercelen. Enélkül minden cron 500 `cron_not_configured`.
- Az **óránkénti** airing-push (`/api/cron/airing-check` mode nélkül) a Hobby-terven nem fér el
  (napi 1 futás/slot). Ha kell: cron-job.org hívja óránként ugyanazzal a Bearer-fejléccel,
  vagy Vercel Pro.
- Teljes (történelmi) katalógus-sync továbbra is kézzel: `scripts/sync-catalog.mjs`,
  elavult sorok frissítése: `scripts/sync-stale.mjs`.

## Hibafigyelés

- Kliens-hibák: `src/app/global-error.tsx` → `POST /api/monitor` → `console.error`
  (Vercel-logokban látszik) + ha van **`SENTRY_DSN`** env, továbbítás a Sentry store API-ra.
  SDK nélkül — a DSN beállítása elég, kód nem kell hozzá.
- Szerver-hibák: a Vercel Functions logja natívan gyűjti.
- Uptime: mutasd az UptimeRobotot (vagy bármely pingert) a `/api/health`-re — 200 + `{"ok":true}`.

## Jogi oldalak üzemeltető-adatai

Env-ből töltődnek (build-time), kód-módosítás nélkül:

```
NEXT_PUBLIC_OPERATOR_NAME=…
NEXT_PUBLIC_OPERATOR_ADDRESS=…
NEXT_PUBLIC_OPERATOR_REGISTRATION=…   # opcionális
NEXT_PUBLIC_OPERATOR_EMAIL=…
```

Kitöltetlen mezőnél TODO-szöveg jelenik meg az /adatvedelem és /aszf oldalon —
élesítés előtt kötelező beállítani.
