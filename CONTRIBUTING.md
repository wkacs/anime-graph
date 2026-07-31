# Contributing

Köszönjük a közreműködést.

1. Forkold a repót, és készíts rövid, célzott branchet.
2. Ne commitolj `.env` fájlt, adatbázis-mentést vagy valós felhasználói adatot.
3. Tartsd meg a privacy alapállapotokat: publikus adat csak explicit opt-innel.
4. Új külső hálózati híváshoz adj timeoutot és hibakezelést.
5. Adatbázis-változás legyen additív vagy külön, dokumentált migrációval.
6. Beküldés előtt futtasd:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
```

A pull request írja le a felhasználói hatást, a kockázatot, az ellenőrzést és
az esetleges konfigurációs/migrációs lépést. Biztonsági hibát ne publikus pull
requestben vagy issue-ban jelents; lásd a [SECURITY.md](SECURITY.md) fájlt.

