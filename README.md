# Anime Graph

Anime- és manga-követő személyes 3D térképpel, ízlésalapú ajánlásokkal,
MAL/AniList importtal, publikus katalógussal és opt-in megosztással.

## Technológia

- Next.js 15 App Router, React 19, TypeScript
- Neon Postgres + Drizzle ORM
- GLM, opcionális OpenRouter fallback
- Resend rendszerlevelek
- Vercel Cron + GitHub Actions
- Vitest és ESLint

## Helyi indítás

Előfeltétel: Node.js 20+ és egy Neon/Postgres adatbázis.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Töltsd ki legalább a helyi használathoz szükséges értékeket az `.env.local`
fájlban. Titkot soha ne commitolj. A Drizzle CLI nem tölti be automatikusan a
`.env.local` fájlt, ezért a `DATABASE_URL`-t a migráció futtatásakor add át a
folyamatnak.

```powershell
$env:DATABASE_URL = 'postgres://...'
npm run db:push
npm run dev
```

Az alkalmazás alapértelmezetten a <http://localhost:3000> címen indul.
Külső levélküldő nélkül a helyi regisztráció fejlesztői módban automatikusan
megerősítettnek számít; productionben a levélküldés fail-closed.

## Minőségellenőrzés

```powershell
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

A production build szándékosan megáll hiányzó publikus URL vagy jogi
üzemeltetői adat esetén. A teljes élesítési és Resend/cron ellenőrzőlista:
[docs/DEPLOY.md](docs/DEPLOY.md).

## Biztonsági alapállapotok

- Az új és a régi, beállítás nélküli profilok privátak; a publikus profil opt-in.
- Nyers véleményszöveg nem kerül közösségi vagy publikus API-válaszba.
- A publikus/közösségi nézetek kizárják az AniList által felnőttként jelölt címeket.
- Az auth-tokenek hash-elve, egyszer használhatóan és lejárattal tárolódnak.
- Productionben kötelező globális AI-költségplafon és valódi session/cron titok.
- Minden cron Bearer tokennel védett, és részfeladat-hiba esetén nem ad hamis 200-at.
- A kapcsolt MAL/AniList OAuth-tokenek AES-256-GCM titkosítva kerülnek az adatbázisba.

Biztonsági hiba jelentéséhez lásd a [SECURITY.md](SECURITY.md) fájlt.

## Parancsok

- `npm run dev` – fejlesztői szerver
- `npm run build` / `npm start` – production build és futtatás
- `npm run lint` – statikus ellenőrzés
- `npm run typecheck` – TypeScript ellenőrzés
- `npm test` – Vitest tesztek
- `npm run db:generate` / `npm run db:push` – Drizzle sémaeszközök

## Közreműködés és licenc

A közreműködési szabályok a [CONTRIBUTING.md](CONTRIBUTING.md) fájlban vannak.
A projekt [MIT licenc](LICENSE) alatt érhető el.
