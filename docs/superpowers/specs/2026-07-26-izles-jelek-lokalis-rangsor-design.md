# Ízlés-jelek és lokális rangsor — az AI tanuljon, a matek alkalmazzon

*Spec, 2026-07-26. Állapot: jóváhagyva, implementációs terv következik.*

## 1. Miért

Két probléma találkozott:

**Kvóta.** A GitHub Actions perckerete elfogyott, és a nyílt regisztrációval (Gate A) a közös
`GLM_API_KEY` is elfogyna. Ma minden ajánlás, vibe-keresés és szezon-pontozás egy-egy
modellhívás, felhasználónként. Ezek **böngészéshez kötöttek**, tehát a hívásszám a
felhasználószámmal és az aktivitással együtt korlátlanul nő.

**A tanult tudás nincs használva.** Az AI a véleményekből ízlés-tényeket nyer ki
(`extract` → `taste_memory`), de a `buildTasteVector` **kizárólag a `user_title`-ből**
dolgozik: műfaj, tag, státusz, pontszám. Amit az AI megtanult, azt ma csak úgy lehet
felhasználni, hogy a nyers tényeket beleöntjük egy újabb modellhívásba.

Ráadásul **két külön ízlés-modell él a kódban**, és a gyengébbik dolgozik a fő funkción:

| | Mit tud | Hol használjuk |
|---|---|---|
| `candidates.ts` → `genreWeights` | csak műfaj, `myScore − 5`, nincs normalizálás | **a recommend rangsora** |
| `fit-score.ts` → `buildTasteVector` | műfaj + tag, státusz-jel, normalizálva, mintaküszöb | csak a `FitBadge` |

## 2. Alapelv

**Az AI tanuljon, a matek alkalmazzon.**

A tanulás ritka és emberi tempóhoz kötött: egy modellhívás per megírt vélemény. Az
alkalmazás gyakori és böngészéshez kötött. Ma fordítva van súlyozva a költség.

Ez a változtatás **nem csökkenti az ízlés-megértést, hanem növeli**: amit az AI megtanult,
végre mindenhol számítani fog, nem csak egyetlen prompt belsejében.

## 3. Hatókör

### Benne van

- Az `extract` strukturált ízlés-jeleket is visszaad a szabad szöveges tények mellett
- Új `taste_signal` tábla, kötött szókészlettel
- A `buildTasteVector` összefésüli a viselkedési és a szemantikus jelet
- A `fit-score` lesz az egyetlen rangsoroló; a `genreWeights`/`rankCandidates` nyugdíjba megy
- `explainFit`: ingyenes, őszinte indoklás a vektorból
- A `recommend`, `seasonal` és a `vibe`-chipek lokálisra váltanak
- AI-újraírás igényre („Mondd el bővebben")

### Nincs benne

- Az AI kivezetése a tanulásból. Az `extract`, `profile`, `taste-eras` érintetlen — **ezek a termék**
- `digest`, `nl-search`, `duo`, `group-pick` — maradnak AI-on
- BYOK (saját kulcs) — külön kör, ez a spec nem függ tőle
- Fizetős tier, Stripe

## 4. Döntések és indoklásuk

| Döntés | Választás | Miért |
|---|---|---|
| Jel-tér | Csak amit a katalógus is ismer: műfaj, tag, `format`, hossz-sáv, korszak, `studio`, forrás | Egy még nem látott címről CSAK ezeket tudjuk összevetni. A „lassú első 6 rész" típusú tény marad szabad szövegnek: UI-ban és promptban értékes, de nem számszerűsíthető |
| Szókészlet forrása | A vélemény tárgyának saját műfajai és tagjei | A vélemény egyetlen címről szól, tehát a jelölt feature-ök szinte biztosan a cím sajátjai. Így a prompt nem hízik meg az AniList ~500 tagjétől, és a jel garantáltan illeszkedik a katalógushoz |
| Tárolás | Külön `taste_signal` tábla | Egy tényből több jel is jöhet (1:N), és a `taste_memory` sorai **megjelennek a felületen** (TasteCard, ProfileReveal) — a gépi jelek nem valók oda |
| Indoklás | Lokális alapból, AI gombra | A vektor pontosan tudja, miért jött ki a pontszám. Ha az AI írná minden alkalommal, a kvóta-megtakarítás nulla lenne |
| Backfill | Ingyenes heurisztika, nem AI | A meglévő tények szövegét összevetjük a cím műfaj- és tagneveivel. Durva, de azonnali kiindulást ad nulla hívásból |

## 5. Adatmodell

### Az `extract` séma bővítése

Ugyanaz az egy hívás vélemény-íráskor, gazdagabb kimenettel:

```json
{
  "facts": [{ "kind": "like", "text": "a time-travel szál végig feszes volt" }],
  "signals": [{ "feature": "tag:Time Manipulation", "polarity": 1, "strength": 0.8 }]
}
```

- `feature`: `genre:<név>` \| `tag:<név>` \| `format:<érték>` \| `length:<sáv>` \| `era:<évtized>` \| `studio:<név>` \| `source:<érték>`
- `polarity`: `1` (tetszett) vagy `-1` (zavarta)
- `strength`: `0..1`

A származtatott tengelyek pontos értékkészlete (a `title` sorból számolva, hogy egy még
nem látott címre is előállítható legyen):

| Tengely | Érték | Forrás |
|---|---|---|
| `length` | `short` (≤ 13 rész), `standard` (14–26), `long` (27–99), `endless` (100+) | `title.episodes`; manga esetén `title.chapters` szerint ugyanez a négy sáv 30/100/300 határokkal |
| `era` | `1990s`, `2000s`, `2010s`, `2020s` | `title.year` |
| `format` | `TV`, `MOVIE`, `OVA`, … | `title.format` változatlanul |
| `studio` | a stúdió neve | `title.studio` |
| `source` | `MANGA`, `ORIGINAL`, `LIGHT_NOVEL`, … | a `title.relations` SOURCE eleme; ha nincs, a tengely kimarad |

A prompt a cím saját műfaj- és taglistáját kapja meg választható értékként, plusz a
fenti tengelyek konkrét értékeit az adott címre.

### Új tábla: `taste_signal`

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | `serial primary key` | |
| `user_id` | `integer not null` | |
| `title_id` | `integer not null` | FK `title(id)` `on delete cascade` |
| `feature` | `text not null` | normalizált kulcs, kisbetűsítve |
| `polarity` | `integer not null` | `1` vagy `-1` |
| `strength` | `real not null default 1` | `0..1` |
| `source` | `text not null` | `opinion` \| `backfill` |
| `created_at` | `timestamp not null default now()` | |

Index: `(user_id)`, és `unique (user_id, title_id, feature)` — egy címre egy feature
egyszer szerepeljen, újra-extractáláskor felülíródik. A `title_id` azért `not null`,
mert mindkét forrás (vélemény, backfill) egy konkrét címhez kötődik; így a unique-index
NULL-kezelése sem okoz duplikátumot.

### Szókészlet-őr

Írás előtt minden jel `feature`-ét ellenőrizzük a cím tényleges feature-készletéhez.
Ami nem illik bele, **eldobjuk** — nem szennyezheti a vektort olyan kulcs, amit a
katalógus sosem fog visszaadni.

### Backfill

Egyszeri script: minden meglévő `taste_memory` sorra megnézi, hogy a tény szövege
tartalmazza-e az adott cím valamelyik műfaj- vagy tagnevét, és ha igen, `source='backfill'`
jelet ír a tény `kind`-jából adódó polaritással (`like` → +1, `dislike` → −1,
`note` → kihagyva). Nulla AI-hívás.

A `taste_memory.animeId` a `user_title` id-ja, nem `title_id` — a script az `anime`
nézeten át képezi le (`anime.titleId`). A globális, cím nélküli tények
(`animeId IS NULL`, `source='settings'`) kimaradnak a backfillből.

## 6. Ízlés-vektor és rangsor

A `buildTasteVector` két al-vektort épít:

- **viselkedési** — a mai logika változatlanul: pont és státusz a műfaj/tag kulcsokra
- **szemantikus** — a `taste_signal` sorokból: `polarity × strength` ugyanazokra a kulcsokra

Mindkettőt **külön** normalizáljuk `[-1, 1]`-re, majd:

```
kombinált = viselkedési × (1 − α) + szemantikus × α
```

`α = 0.4` alapból, és kevés jel esetén arányosan csökken (`α_tényleges = α × min(1, jelszám / 20)`).

Azért külön-külön normalizálunk, mert a két forrás nagyságrendje eltér: több száz
értékelés áll szemben pár tucat kinyert jellel. Közös normalizálás elnyomná a szemantikát.
Az α-csökkentés pedig azt biztosítja, hogy egy-két vélemény ne forgassa fel a listát.

**Egy hiányzó láncszem:** a `RecCandidate` és a `CatalogRow` ma csak `genres`-t hoz,
`tags`-et nem — pedig a vektor a tageken a legerősebb (`TAG_FEATURE_WEIGHT = 0.6`).
A katalógus-lekérdezésnek a `tags` oszlopot is be kell húznia, különben a jobb modell
a jelöltek felét vakon pontozná.

**`explainFit(vector, target)`** — visszaadja, mely feature-ök húzták fel és le a
pontszámot. Ez adja a lokális indoklást, és ugyanez hajtja a `FitBadge` „mellette /
ellene" sorát, ami ma külön számolódik.

## 7. Felületek

| Felület | Ma | Ezután |
|---|---|---|
| `seasonal` | AI-pontozás minden szezon-címre, felhasználónként | Tisztán fit-score. **A legnagyobb megtakarítás** — a News-betöltéshez kötött, ez fut a legtöbbet |
| `recommend` | AI rangsorol és indokol | Fit-score rangsorol, `explainFit` indokol; AI-próza gombra |
| `vibe` chipek | AI | Tisztán lokális — a chipek eleve strukturáltak |
| `vibe` szabad szöveg | AI rangsorol és indokol | **Egy** AI-hívás: szöveg → feature-ek, utána lokális rangsor |

A vibe szabad szövegéhez tartozó új, szűk prompt ugyanazt a kötött szókészletet
használja, mint a jel-kinyerés, csak fordítva: a felhasználó mondatából ad vissza
`{ feature, polarity, strength }` listát. Ez egy kérés-idejű ízlés-vektor, amit a
tárolt vektorral összegzünk a rangsoroláshoz — nem íródik a `taste_signal`-be, mert
egy pillanatnyi kívánság, nem tartós ízlés.

Változatlanul AI-on: `extract`, `profile`, `taste-eras`, `digest`, `nl-search`, `duo`, `group-pick`.

## 8. Degradáció

A lokális utak nem fogyasztanak kvótát. Elfogyott kerettel a felhasználó **rangsort és
indoklást is kap**, csak nem prózát. Ma ilyenkor 502 érkezik („nincs elég katalógus-adat"
vagy AI-hiba).

## 9. Tesztelés

A repó mintája szerint, adatbázis és hálózat nélkül:

- **jel-összefésülés**: az α szerinti súlyozás, és hogy kevés jelnél arányosan visszaesik
- **szókészlet-őr**: a cím feature-készletén kívüli jelet eldobjuk
- **`explainFit`**: a legtöbbet hozó és legtöbbet rontó feature-ök helyes sorrendben
- **regresszió**: a meglévő `fit-score` tesztek maradjanak zöldek — jel nélkül a viselkedési ág eredménye nem változhat
- **nulla-AI bizonyíték**: teszt, ami igazolja, hogy a recommend rangsora modellhívás nélkül előáll
- **backfill**: a heurisztika a tény `kind`-jából helyes polaritást ad, `note` kimarad

## 10. Elfogadási kritériumok

1. Vélemény mentése után a `taste_signal` táblában megjelennek a jelek, kizárólag a cím
   saját feature-készletéből
2. A recommend, a seasonal és a vibe-chipek **egyetlen modellhívás nélkül** adnak rangsort
   és indoklást
3. Kvóta kimerülésekor egyik felület sem ad 502-t
4. A „Mondd el bővebben" gomb pontosan egy hívást indít, és az `ai_usage_log`-ban megjelenik
5. Jel nélküli felhasználónál a `buildTasteVector` kimenete bitre azonos a maival
   (a recommend rangsora ettől még változik, mert ma a gyengébb `genreWeights` hajtja —
   ez szándékos javulás, nem regresszió)
6. Minden teszt, `tsc`, `eslint`, prod-build és `next start` smoke zöld

## 11. Kockázatok

| Kockázat | Kezelés |
|---|---|
| A modell a cím feature-készletén kívüli jelet ad vissza | A szókészlet-őr eldobja; teszt fedi |
| A szemantikus jel túl erős, felforgatja a megszokott listát | Külön normalizálás + α-csökkentés kevés jelnél; α konstans, hangolható |
| A lokális indoklás szárazabb, mint a mai próza | A „Mondd el bővebben" gomb megtartja a prózát annak, aki kéri |
| A `tags` betöltése lassítja a katalógus-lekérdezést | A `tags` már a `title` soron van, nem külön join; a jelöltlista amúgy is limitált |
| A backfill-heurisztika téves jeleket ír | `source='backfill'` megkülönbözteti őket, így később AI-jelre cserélhetők vagy törölhetők |

## 12. Végrehajtási sorrend

1. **Adat**: `taste_signal` tábla + migráció, `extract` séma-bővítés, szókészlet-őr, backfill-script
2. **Vektor**: `buildTasteVector` szemantikus ága, α-logika, `explainFit`, `tags` átvezetése a jelölt-úton
3. **Felületek**: `seasonal` → lokális, `recommend` → lokális + „bővebben" gomb, `vibe`-chipek → lokális,
   `genreWeights`/`rankCandidates` kivezetése

Mindhárom szakasz önmagában zöld tesztekkel és működő appal zárul.

## 13. Mérés

Az `ai_usage_log` már rögzít minden hívást endpointonként. Az átállás előtti és utáni
hívásszám összevethető — nem tippelni fogjuk, hogy megérte-e.
