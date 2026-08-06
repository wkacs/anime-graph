# Anime Graph — külső visszajelzés, összevonva

> Dátum: 2026. augusztus 6.
> Forrás: két független külső átolvasás (ChatGPT és Claude) az `ANIME_GRAPH_PRODUCT_BRAINSTORM.md` doksiról.
> Ez a fájl a kettő összefésült változata: az egyetértések egyszer szerepelnek, az ellentmondások fel vannak oldva, a végén egy közös fejlesztési és promóciós sorrend áll.

---

## 0. Hogyan olvasd

- **Egyetértés:** mindkét átolvasás ugyanazt mondta. Ezek a legerősebb jelzések.
- **Csak az egyik hozta:** egy oldalról jött, de értékes. Külön jelölve, mert nincs mögötte kettős megerősítés.
- **Feloldott ütközés:** a kettő mást javasolt, itt van a döntés és az indoka.

Az egész visszajelzés-csomag lényege egy mondatban: a doksiban már most több funkció van, mint amennyi az indulásához kell, és a következő szintet nem egy újabb oldal adja, hanem az, hogy az első látogatástól számított egy percen belül a felhasználó azt mondja: „ez tényleg az én ízlésem”.

---

## 1. Összkép

Belső termékdokumentációnak erős (kb. 9/10), publikus app-leírásnak gyengébb (kb. 6/10). A dokumentum alapján az Anime Graph egyszerre akar lenni tracker, ajánlórendszer, ízlés-önismereti eszköz, 3D vizualizáció, szezonkövető, közösségi platform, valamint páros és csoportos választó.

A legerősebb rész egyértelműen nem a tracker, hanem ez:

> Importáld a meglévő listádat, lásd vizuálisan az ízlésedet, kapj magyarázható ajánlást arra, mit nézz következőnek.

A vezetői összefoglalóban megfogalmazott stratégiai irány pontos: nem újabb listakezelő, hanem a meglévő lista fölötti személyes intelligenciaréteg.

Fontos elismerés a doksinak: a legtöbb klasszikus javaslat (fit confidence, ajánlási feedback, ghost node-ok, kalibráció) már benne van a saját roadmapben, és a prioritási mátrix is helyesen teszi ezeket előre, a klasszikus social platformot pedig hátra. Ezért az alábbi lista főleg arra fókuszál, ami hiányzik, vagy ahol a keret vitatható.

---

## 2. Pozicionálás

**Egyetértés: a katalógusméret nem hero-állítás.**
A „22 000 anime, 136 000 manga, 150 000+ cím” jó bizalmi adat, de nem különböztet meg. Az AniList már most trackinggel, statisztikával, közösségi funkciókkal és ajánlásokkal pozicionálja magát, az Anime-Planet szintén trackinget és személyre szabott ajánlást kommunikál. A hero legyen a gráf és a fit score, a katalógusméret pedig lejjebb, bizalmi sávban.

**Landing fő szöveg javaslat:**

> **Your anime taste, mapped.**
> Import your AniList or MAL. Discover the patterns behind what you love and get explainable picks for what to watch next.

- Elsődleges CTA: **Map my taste**
- Másodlagos CTA: **View a demo graph**

**Kerülendő megfogalmazás:** „AI anime tracker”. Túl általános, és könnyen ChatGPT-wrappernek olvassák. Jobb kategóriák: *personal anime intelligence*, *visual taste map*, *recommendation layer for your AniList or MAL*.

**Komplementer, nem leváltó.** Legalább az első időszakban AniList/MAL-kiegészítőként kommunikálni. Így nem kell a felhasználótól azt kérni, hogy hagyja el a többéves rendszerét. Ennek a licenc-fejezet miatt jogi haszna is van (lásd 6. pont).

---

## 3. Az első 60 másodperc

Ez a legfontosabb hiányzó blokk, és a két átolvasás ugyanazt a problémát két oldalról fogta meg. Együtt egy folyamatot adnak ki.

### 3.1 Bejelentkezés nélküli Taste Scan

A landingen a felhasználó beírja a publikus AniList-felhasználónevét, és regisztráció nélkül kap:

- részleges gráfot,
- három rövid ízlésmegállapítást,
- top műfaji vagy hangulati szigeteket,
- egy meglepő ajánlást,
- megosztható képet.

A teljes gráfhoz, mentéshez és folyamatos tanuláshoz regisztrál. Ez oldja meg a doksiban is azonosított hidegindítási problémát: import vagy több kézi cím nélkül jelenleg kevés „varázslatot” lát az új felhasználó.

### 3.2 Konkrét import wow moment

A Now-listában szereplő „gyorsabb és látványosabb import utáni érték” túl absztrakt. Legyen mérhető: **import után 10 másodpercen belül egy statikus insight-kártya**, ami olyat mond, amit a MAL és az AniList sosem mutatott. Például:

> A top 3 stúdiód X, Y, Z. Ez a felhasználók 4%-ára jellemző.

Ez a pillanat dönti el, hogy visszajön-e a felhasználó. A percentilis a kulcs: nem statisztika, hanem ítélet a felhasználóról.

### 3.3 Reveal, nem táblázat

Az import utáni megjelenítés legyen animált feltárulás, ne kész táblázat egy lapon. A gráf a legerősebb márkaelem, de a doksi is helyesen jelöli veszélynek, hogy önmagában egyszeri wow-pillanat marad.

---

## 4. Funkciók, amiket hozzátennék

### 4.1 Taste Passport (megosztható ízlés-névjegy)

Egyszerű, publikus, a felhasználó által jóváhagyott kártya:

- „Your taste in 5 traits”,
- három kedvenc ízlésirány,
- két kerülendő elem,
- mainstream–niche skála,
- comfort–intense skála,
- 3–5 meghatározó cím,
- kis gráfrészlet.

Minden kártya alján: *Create your own Anime Graph*. Ez egyszerre profilfunkció és organikus marketingeszköz.

### 4.2 „Compare our taste” meghívólink

**Egyetértés:** a Versus/Duo ne csak retenciós feature legyen, hanem növekedési hurok, K-faktor forrás.

Mechanika: a felhasználó megoszt egy linket. A másik fél beírja az AniList-nevét, azonnal lát egy részleges kompatibilitási eredményt, és regisztráció után kapja meg a teljes közös gráfot és az ajánlásokat. Ez sokkal természetesebb meghívás, mint egy sima „invite a friend”.

### 4.3 Fit score: először minősítés, utána szám

A 78% túl pontosnak látszik egy heurisztikus modellhez. Ezt a doksi is jól felismeri. Megjelenítés:

```
Strong fit · 78%

High confidence
Based on 31 related titles
You usually like: psychological tension, strategic protagonists
Possible issue: slow middle section
```

A fő információ a **Strong fit / Mixed fit / Experimental fit / Low fit** címke, a százalék másodlagos.

### 4.4 Azonnali cselekvés a gráfban

- 3–5 ghost recommendation a gráf szélén,
- „Why is this connected?”,
- „Add to Plan” közvetlenül a node-ról,
- „Not for me”,
- „Show the path from Code Geass to this”,
- 8–10 másodperces megosztható gráfanimáció.

### 4.5 Season-fit mint tartalomgyártó motor

*(Csak az egyik átolvasás hozta, de az egyik legjobb ötlet a csomagban.)*

Minden szezonváltásnál generálódjon egy megosztható „ez a szezon a te ízlésed szerint” oldal vagy kép. Ingyenes, folyamatos, evergreen tartalom, amit maga a termék termel, negyedévente újrainduló megosztási hullámmal.

---

## 5. Amit visszavennék vagy elrejtenék

Nem törölni, csak elrejteni a kezdeti felhasználó elől.

### 5.1 Mobil navigáció

Jelenleg mobilon a Graph a More menübe kerül, miközben a Reviews külön fő tab. Ez fordítva logikus: a Graph a termék neve és fő megkülönböztető eleme, a véleményírás pedig kontextuális művelet.

Javasolt elsődleges mobil navigáció:

```
Today · List · Discover · Graph · Profile
```

A Review prompt a completed státusz után jelenjen meg, illetve legyen egy kisebb inbox a profilon belül.

### 5.2 Discover összevonás

A Browse, Recommend és Vibe felületek egy közös **Discover** terület alá. A felhasználónak nem kell értenie, melyik ajánlás AI, lokális vagy strukturált keresés; csak azt, hogy milyen módon szeretne választani.

### 5.3 Hátrébb tolandó

- általános community feed,
- follow-rendszer,
- DM,
- teljes watch room,
- WebXR,
- komplex staff- és karakterhubok,
- teljes anime–manga feature-paritás,
- többféle leaderboard.

**Feloldott ütközés:** mindkét átolvasás a Later-be tenné a social réteget, de az egyik szigorúbb. A szigorúbb álláspont nyer: **amíg a nyers vélemény és a taste-signal privát adat, minden social feature-nél fennáll a kockázat, hogy véletlenül publikus adattá válik.** Ezért a social nemcsak sorrendben van hátrébb, hanem külön adatvédelmi tervet is igényel, mielőtt bármelyik eleme elindul. A Taste Passport ezért kifejezetten *jóváhagyott*, nem automatikus publikálás.

---

## 6. Kockázatok

### 6.1 Adatforrás és licenc

Ez jelenleg a legfontosabb hiányzó üzleti kockázat a doksiból.

Az AniList API aktuális feltételei tiltják az API backup- vagy adattárolási szolgáltatásként való használatát, és a velük versengő, nem komplementer tracker szolgáltatásokhoz külön engedélyt írnak elő. A jelenlegi feltételek szerint havi 150 dollár feletti kereskedelmi bevételnél kereskedelmi licencet is egyeztetni kell.

Publikus indulás és főleg monetizáció előtt írásban tisztázandó:

- használható-e a központi lokális katalógus ebben a formában,
- milyen adatot tárolhatsz tartósan,
- szükséges-e folyamatos AniList-sync,
- mikor kell kereskedelmi licenc,
- milyen forrásmegjelölés kell.

Ez a pont visszahat a 2. fejezetre: a komplementer intelligence layer pozicionálás nemcsak marketing-, hanem licenc-érv is.

### 6.2 Adatvédelem

Lásd 5.3. A vélemény és a taste-signal nyers formában érzékeny adat. Bármilyen megosztási vagy social funkció alapértelmezése legyen privát, a publikálás pedig explicit, kártya-szintű jóváhagyás.

### 6.3 Árazás kerete

Az AI-kvóta alapú gondolkodás (a korábban emlegetett 3–5 EUR AI-kvóta) rossz keret a felhasználó felé. A Pro-lista már jól csinálja, mert feature-alapú, nem számláló, de a **kommunikáció** ne az AI-hívást árazza, hanem az insight-mélységet.

- Rossz keret: „10 Vibe keresés/hét”.
- Jó keret: „korlátlan alap ajánlás, mély taste-DNS csak Pro-ban”.

---

## 7. Promóció

Vezérelv: **nem az appot promózzuk, hanem az emberek saját animeízlésének eredményét.**

### 7.1 Rövid videó (elsődleges aktív csatorna)

TikTok, Instagram Reels, YouTube Shorts: ugyanaz az eredeti képernyőfelvétel mindháromra adaptálható.

Videóötletek:

- „I imported 400 anime and this is what my taste looks like.”
- „My anime taste has three completely separate islands.”
- „This app predicted which anime I would drop.”
- „What your AniList says about you.”
- „My taste in 2020 vs 2026.”
- „My friend and I are only 34% compatible.”
- „Anime Graph found the missing link between Death Note and Frieren.”
- „I gave it my MAL and it exposed my most specific anime preference.”

Szabályok:

- az első 1–2 másodpercben már mozogjon a gráf,
- ne feature walkthrough legyen, hanem egy érdekes személyes eredmény,
- animeepizód-részletek és jogvédett zene helyett saját UI-felvétel.

### 7.2 SEO (elsődleges passzív csatorna)

A meglévő `/anime/[slug]` oldalak felpörgetése az egyetlen ingyenes, extra komplexitást nem igénylő organikus csatorna, és technikailag már megvan.

**Feloldott ütközés:** az egyik átolvasás a rövid videót tette elsőnek, a másik az SEO-t. Nem versenyeznek: az SEO a folyamatosan futó alapzaj, ami nem igényel napi munkát, a videó pedig az aktív kampány-motor. Az SEO-t kell **először bekapcsolni**, mert egyszeri munka, a videót pedig **folyamatosan tolni**, mert az hozza a csúcsokat.

### 7.3 Animeközösségek

Az AniList fórumon külön **AniList Apps** kategória van, és több külső app fejlesztője is ott mutatta be a projektjét és gyűjtött visszajelzést. Nem reklámszöveggel érdemes odamenni, hanem konkrét tesztelési kéréssel:

> I built a visual taste map that imports your AniList. I'm looking for 30 users with 100+ completed titles to test whether its recommendations actually understand them.

**Feloldott ütközés:** az egyik átolvasás javasolta az r/anime posztot, a másik óvott tőle. Az óvatosabb nyer: az r/anime jelenlegi szabályérvényesítése kifejezetten korlátozza az olyan fiókok önpromócióját, amelyek főként a saját termékük vagy üzleti projektjük reklámozására szolgálnak. Launchposzt előtt **modmailben engedélyt kérni**, vagy más, erre alkalmas közösséget választani.

További hiteles felületek: Discord szerverek, MAL fórumok, AniList klubok. Ott fejlesztőként, aki maga is anime-rajongó, insider hangot lehet megütni.

### 7.4 Mikrocreatorok

20–30 kisebb animecreator, de nem általános szponzoráció. Előre elkészítve az ő saját AniList-jükből:

- taste graph,
- Taste Passport,
- három meglepő insight,
- kompatibilitás egy másik creatorral.

A tartalom maga a **reakciójuk** arra, amit az app állít róluk. Ez hitelesebb, mint egy hagyományos „this video is sponsored by”.

### 7.5 Product Hunt

Jó technológiai bemutatkozásra és early adopter forgalomra, de nem elsődleges anime-user csatorna. Akkor érdemes menni, amikor már van:

- működő Taste Scan,
- 5–10 jó felhasználói idézet,
- látványos demo,
- gyors import,
- publikus share link.

### 7.6 Amit nem javaslok

Fizetett hirdetés az induláskor. Az anime közösség erősen social-media-driven, és a „mi derül ki rólam” típusú tartalom organikusan terjed. A pénz akkor jön, ha már mérhető a share-arány.

---

## 8. Közös fejlesztési sorrend

1. **Bejelentkezés nélküli AniList Taste Scan.**
2. **Import utáni látványos reveal + konkrét insight-kártya percentilissel** (10 másodpercen belül).
3. **Fit confidence és „why?”** (minősítés-címke elöl, százalék hátul).
4. **Ajánlási feedback** (Not for me, kalibráció).
5. **Ghost node és közvetlen Plan akció a gráfban.**
6. **Taste Passport és share card.**
7. **Compare our taste meghívólink.**
8. **Season-fit megosztható szezonoldal** (az első szezonváltásra időzítve).
9. Csak ezután közösségi feed vagy komolyabb social funkció, előtte adatvédelmi terv.

Párhuzamosan, fejlesztési sorrendtől függetlenül:

- **Licenc-egyeztetés az AniListtel** (indulás és monetizáció előtti blokkoló, lásd 6.1),
- **SEO `/anime/[slug]` felpörgetés** (egyszeri munka, utána passzív),
- **mobil navigáció átrendezése** (Graph fő tab, Reviews kontextuális).

---

## 9. Nyitott kérdések

- Az AniList licenc-válasza befolyásolja-e a lokális katalógus architektúráját?
- A Taste Scan mennyire részleges legyen? Elég értéket adjon a megosztáshoz, de maradjon ok a regisztrációra.
- A percentilis-állításhoz („a felhasználók 4%-ára jellemző”) mekkora minimális felhasználóbázis kell, hogy ne legyen félrevezető? Addig mi a helyettesítő megfogalmazás?
- A Taste Passport publikálása opt-in kártyánként vagy egyszeri profil-szintű kapcsoló?
