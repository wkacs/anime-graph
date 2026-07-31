# Security policy

## Supported version

Biztonsági javítást az aktuális `master` ág kap. Régi tagekhez vagy forkokhoz
nincs külön támogatási ígéret.

## Sérülékenység jelentése

Ne nyiss publikus issue-t olyan hibáról, amely felhasználói adatot, tokent,
kulcsot vagy jogosulatlan hozzáférést érinthet. Használd a GitHub repository
**Security → Report a vulnerability** privát csatornáját.

A jelentésben add meg:

- az érintett útvonalat vagy komponenst;
- a reprodukció minimális lépéseit;
- a várható és tényleges eredményt;
- az észlelt hatókört;
- lehetőleg javítási javaslatot.

Valódi felhasználói adaton ne végezz destruktív tesztet. API-kulcsot, sessiont
vagy személyes adatot a jelentésbe se másolj be; szükség esetén használj
visszavont vagy tesztértéket.

