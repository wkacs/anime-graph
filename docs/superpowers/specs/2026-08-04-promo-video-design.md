# Promó videó (Remotion) — design

Dátum: 2026-08-04
Állapot: elfogadott design, implementációs terv még nem készült

## 1. Cél

Egy 28 másodperces, közösségi médiára szánt promó klip az Anime Graphról,
Remotionnel (React → MP4). A klip egyetlen üzenetet visz: az ajánlás nem
népszerűségi lista, hanem a felhasználó saját értékeléseiből épül.

Elhelyezés: TikTok, Reels, X, valamint r/anime és r/MyAnimeList típusú
közösségek. Nyelv: angol.

Nem cél: landing hero-loop, README-GIF, hosszú funkcióbemutató. Ezek később
ugyanebből a kompozícióból származtathatók, de most nem készülnek el.

## 2. Rögzített döntések

| Paraméter | Érték |
| --- | --- |
| Hossz | 28 mp, 840 frame, 30 fps |
| Fő arány | 1080×1920 (9:16) |
| Másodlagos arányok | 1080×1080, 1920×1080 ugyanabból a kompozícióból |
| Nyelv | angol |
| Hang | zene, narráció nincs |
| Felirat | égetett, Inter, glass-lite pill, alsó harmad |
| Nyersanyag | hibrid: valódi képernyőfelvétel + Remotionben újraépített hős-jelenet |
| Adatforrás | prod (anime-graph.vercel.app), a tulajdonos saját fiókja |
| Kreatív irány | "Két lista": népszerűségi sorrend kontra fit-score sorrend |

A tulajdonos tudomásul vette, hogy a saját listája és értékelései
megjelennek a nyilvános videóban.

## 3. Beat sheet

Zenei rács: kb. 120 BPM, egy ütem 2 másodperc. A vágások ütemhatárra esnek.

### 0:00–0:02 HOOK (1 ütem)

Kemény bevágás, nincs felúsztatás. Borító-rács tölti ki a képet, felül
`MOST POPULAR` címke. Felirat nagyban:
*"Your anime recommendations are just popularity charts."*
Mozgás: a rács lassan befelé skálázódik.

### 0:02–0:05 SETUP (1,5 ütem)

A kép két oszlopra hasad. Bal oszlop címkéje `POPULAR`, jobbé `YOU`. A jobb
oszlop kezdetben azonos sorrendű és kiszürkített.
Felirat: *"Same season. Two orders."*

### 0:05–0:11 ÁTRENDEZŐDÉS (3 ütem) — hős-pillanat

A jobb oszlop kártyái új pozícióba ugranak, kártyánként `spring()`
animációval, lépcsőzetes késleltetéssel. A népszerűségi élen álló cím
lesüllyed, egy hátsó cím az első helyre kerül. Közben minden kártyára
fit-score jelvény úszik be, a szám nullától felszámol.
Felirat: *"Ranked by your ratings. Not everyone else's."*

### 0:11–0:18 BIZONYÍTÉK (3,5 ütem)

Az új első kártya kinagyít és középre áll. Alatta feltárul a fiókból
származó valódi fit-indoklás, alatta pedig a rangváltás sora
(`popularity #12 → your rank #1`).
Itt nincs plusz felirat: az indoklás maga a bizonyíték, olvasni kell hagyni.

Megjegyzés az indoklásról: a `/api/news/season-scores` a `fitReason()`
függvénnyel **lokálisan**, modellhívás nélkül állítja elő ezt a szöveget.
Determinisztikus, és valószínűleg rövid, címkeszerű. Ezért a jelenetnek két
megjelenítési módja van, és a valódi adat ismeretében kell választani:
mondatszerű indoklásnál egyetlen glass-panel, rövid címkéknél két-három chip.

### 0:18–0:24 MÉRET ÉS HITELESSÉG (3 ütem)

Gyors vágások valódi felvételről: katalógus-görgetés, a 3D gráf forgása
(kb. 1,5 mp), egy wrapped-villanás. Rájuk úszó stat-overlay:
`22,000+ anime · 136,000+ manga`.
Felirat: *"Import from MAL or AniList in 2 minutes."*

### 0:24–0:28 CTA (2 ütem)

Glass-kártya a wordmarkkal és az `anime-graph.vercel.app` címmel, alatta
*"Free. Bring your list."* Az utolsó képkocka statikus és megáll, hogy
thumbnailként és loop-visszatérésként is működjön.

## 4. Projekt elhelyezése

A promó külön npm-projekt: `C:\Users\konig\anime-graph-promo\`.

Indoklás: az anime-graph CI-ja lintet, typecheckel, buildel és vitestet
futtat. Egy beágyazott második npm-projekt ezeket megbukthatja (glob-ok,
tsconfig-hatókör, függőségütközés). A promó semmilyen módon nem befolyásolhatja
a termék buildjét. Ha később mégis a repóba kell, egy mappamozgatással
bevihető, a kizárásokat akkor kell megírni.

Ez a spec viszont a termék repójában marad, mert a promó a termékhez tartozó
döntés.

## 5. Adatforrás

`scripts/pull-data.ts` a prod API-ból húz, és `data/season.json`-t ír.

Végpontok:

- `/api/browse?season=current&type=ANIME&sort=POPULARITY_DESC` — népszerűségi
  sorrend, borító-URL, cím. A `season` paraméter kizárólag a `current` és
  `next` literált fogadja el. Oldalanként 30 tétel, a helyi katalógusból.
- `/api/news/season-scores` — `anilistId`, `title`, `score`, `reason` a
  bejelentkezett fiókra. Legfeljebb 30 tétel, már pontszám szerint rendezve.
  Bejelentkezés nélkül 401. Üres tömb, ha a fióknak nincs saját anime-sora.

A két végpont **nem azonos forrásból** olvas: a browse a helyi `title`
katalógusból, a season-scores az AniList szezon-listájából. Összefésülés
`anilistId`-n, és a metszet mindkettőnél kisebb lehet. A népszerűségi rang a
browse-válasz tömb-indexéből származik, nem oszlopból.

Kimeneti rekord:

```json
{
  "anilistId": 0,
  "title": "",
  "coverFile": "covers/0.jpg",
  "popRank": 0,
  "fitScore": 0,
  "reason": "",
  "basedOn": ["you rated X 10"]
}
```

Hitelesítés: a böngészőből kimásolt session-cookie a promó-projekt
`.env.local` fájljában, amely gitignore-olt. Jelszó nem kerül tárolásra.

A borítók letöltésre kerülnek `public/covers/` alá. Indoklás: a Remotion sok
képkockát renderel párhuzamosan, a távoli AniList-CDN hívások rate limitbe
futnának, és a render nem lenne determinisztikus.

## 6. Valódi felvétel

`scripts/capture.ts` headed Chromiumot indít Playwrighttal, és PNG
képkocka-sorozatot ment, nem videófájlt.

Indoklás:

- A headless Chrome WebGL-kimenete gyakran üres. A 3D gráf pontosan ilyen
  jelenet, ezért headed módban kell rögzíteni.
- A képkockánkénti screenshot determinisztikus: nincs fps-csúszás, nincs
  kodek-artefakt, és a Remotion oldalán egyszerű `<Img>` szekvencia lesz belőle.

Szükséges anyag: kb. 180 kocka, ami 6 másodperc 30 fps mellett. Jelenetenként
külön mappa: `public/frames/graph/`, `public/frames/catalog/`,
`public/frames/wrapped/`.

## 7. Remotion-architektúra

```
anime-graph-promo/
  package.json
  remotion.config.ts
  .env.local            (gitignore)
  data/season.json
  public/
    covers/
    frames/{graph,catalog,wrapped}/
    music.mp3
  scripts/
    pull-data.ts
    capture.ts
    contact-sheet.ts
  src/
    Root.tsx
    Promo.tsx
    schema.ts
    theme.ts
    scenes/
      Hook.tsx
      Split.tsx
      Proof.tsx
      Scale.tsx
      Cta.tsx
    components/
      PosterCard.tsx
      FitBadge.tsx
      Caption.tsx
      Glass.tsx
      FrameSequence.tsx
```

Felelősségek:

- `Root.tsx` — három kompozíciót regisztrál: `Promo9x16`, `Promo1x1`,
  `Promo16x9`. Mindhárom ugyanazt a `Promo` komponenst rendereli, csak a
  méretük tér el.
- `Promo.tsx` — az idővonal. Kizárólag `<Sequence>` elemeket helyez el a beat
  sheet szerint, jelenet-logikát nem tartalmaz.
- `scenes/*` — egy jelenet, egy fájl. Mindegyik a saját `frame`-jét a
  `useCurrentFrame()`-ből kapja, a sequence-eltolás miatt nullától indul.
- `components/*` — újrahasznált építőelemek, jelenet-független.
- `theme.ts` — az app design-tokenjei átemelve (Inter, glass-rétegek,
  `text-1`/`text-2`, silver akcens, sugarak). Ez tartja egy nyelven a videót és
  a terméket. Emberi másolás, nem futásidejű import: a promó nem függhet az app
  build-jétől. Ugyanitt lakik az időzítési rács is: a `BPM` és `FPS`
  konstansokból származik minden jelenethatár, hogy zenecserekor egyetlen szám
  átírása elég legyen.
- `schema.ts` — zod séma a propokra. Ettől a Remotion Studióban szerkeszthetők
  az értékek, és `--props`-szal felülírhatók render közben.

Arány-kezelés: nincs három layout. A jelenetek a `useVideoConfig()`
szélesség/magasság arányából számolnak. Portré esetén a két oszlop egymás
mellett fut (két 2:3 borító elfér 1080 szélességben), fekvő esetén klasszikus
split marad.

Az átrendeződés nem kézzel animált. A `popRank → fitRank` leképezésből
számolódnak a cél-pozíciók, kártyánként `spring()` és lépcsőzetes késleltetés.
Ha szezont váltunk, az animáció magától újrahangolódik az új adatra.

## 8. Ellenőrzés és költségfék

A videó minőségét nem lehet kód-olvasással megítélni, renderelni kell. Ez a
munkafolyamat legdrágább része, ezért:

- Kulcs-képkockák `npx remotion still --frame=N` paranccsal, majd
  `scripts/contact-sheet.ts` egyetlen kontakt-lapba montázsolja őket ffmpeggel.
  Így egy kép kerül átnézésre nyolc helyett.
- Ellenőrzési pontok: f30, f90, f200, f330, f420, f560, f700, f820.
- Iteráció fél felbontáson (540×960), végrender 1080×1920.
- Checkpoint: az első teljes vázlat után a tulajdonos ítél a kontakt-lap
  alapján, és csak utána indul a finomítás. Ez a redo-fék.

Végrender:

```powershell
npx remotion render Promo9x16 out/promo-9x16.mp4
```

## 9. Kockázatok

| Kockázat | Mérséklés |
| --- | --- |
| A fit-score sorrend nem tér el láthatóan a népszerűségitől, így az átrendeződés lapos | Az adat-lehúzás az első implementációs lépés, még a jelenetek kódja előtt. Ha az eltérés kicsi, szezont váltunk, vagy a kreatív irányt igazítjuk. |
| A 3D gráf headless Chrome-ban üres képet ad | Headed Chromium a felvételhez. Ha úgy sem megy, kézi OBS-felvétel. |
| A fit-indoklás túl rövid ahhoz, hogy 7 másodpercet kitöltsön | A BIZONYÍTÉK jelenetnek két módja van (mondat vagy chipek), a valódi adat ismeretében választva. A hős-kártya a legnagyobb rangváltású cím, nem a legmagasabb pontszámú, így a rangváltás sora önmagában is hordoz információt. |
| A klip generikus SaaS-reklámnak hat | A kontakt-lapos checkpoint a vázlat után, még a finomítás előtt. |
| A zene ütemezése eltér a vágásoktól | A végleges zenesáv előtt minden időzítés provizórikus. A `theme.ts` egy `BPM` konstansból számolja az ütemhatárokat, így a sáv cseréjekor egy szám átírása elég. |

## 10. Nyitott inputok

1. Zenesáv. A tulajdonos ad fájlt, vagy licencmentes forrás javaslata kell.
   A vágás-időzítés a végleges BPM-hez igazodik.
2. Prod session-cookie az adat-lehúzáshoz. Az implementáció első lépésénél kell.

## 11. Szándékosan kihagyva

- Narráció és TTS.
- Több nyelvi változat. Az angol az egyetlen kimenet, a szövegek propból
  jönnek, így egy magyar variáns később olcsón hozzáadható.
- Landing-beágyazás és README-GIF.
- Automatizált CI-render. A promó eseti anyag, nem folyamatos build-termék.
