// Taste Scan: mit lehet mondani valakinek a PUBLIKUS AniList-listajabol, fiok
// nelkul, egyetlen kerdesre („mi a felhasznaloneved?").
//
// Ket szabaly vezeti az egeszet:
//   1. Csak olyan allitas kerulhet ki, aminek a fedezete ebben a listaban van.
//      Nincs „a felhasznalok 4%-ara jellemzo" tipusu allitas, amig nincs mihez
//      merni — a percentilis-allitas kis bazison felrevezeto.
//   2. A scan SZANDEKOSAN reszleges. A teljes graf, a mentes es a tanulas a
//      regisztracio mogott van; ami itt kimegy, az onmagaban is erjen valamit.
//
// Tisztan fuggveny: nincs halozat, nincs db, nincs Date.now(). Igy tesztelheto,
// es ugyanez a kimenet hasznalhato kesobb megoszthato kephez is.

export type ScanEntry = {
  anilistId: number
  title: string
  coverUrl: string | null
  /** AniList lista-statusz: COMPLETED, CURRENT, DROPPED, PLANNING, PAUSED */
  status: string
  /** 0–10; a 0 az AniList-nel „nincs pont", nem „nulla pont" */
  score: number | null
  genres: string[]
  tags: { name: string; rank: number }[]
  studio: string | null
  year: number | null
  /** kozossegi pont 0–100 */
  averageScore: number | null
  /** hany felhasznalo listajan van — ebbol jon a mainstream–niche tengely */
  popularity: number | null
}

export type TasteIsland = {
  /** a szigetet nevado (legerosebb) mufaj */
  name: string
  /** a szigethez olvadt tovabbi mufajok, erosseg szerint */
  members: string[]
  count: number
  /** a lista hany szazaleka */
  share: number
}

export type ScanInsight =
  /** `dominant`: egy sziget lefedi a lista tulnyomo reszet — akkor NEM a szigetek
   *  szama a hir, hanem az, hogy a lista egyetlen nagy tomb. */
  | { kind: 'islands'; count: number; names: string[]; dominant?: string }
  | { kind: 'topStudio'; studio: string; count: number; share: number }
  | { kind: 'signature'; feature: string; lift: number }
  | { kind: 'rating'; direction: 'harsh' | 'generous'; delta: number }
  | { kind: 'niche'; score: number }

export type ConstellationNode = {
  anilistId: number
  title: string
  coverUrl: string | null
  island: string
  /** [-1, 1] egysegnegyzet, hogy barmilyen vaszonra skalazhato legyen */
  x: number
  y: number
  /** [0, 1] relativ meret */
  r: number
}

export type ScanResult = {
  sample: number
  rated: number
  islands: TasteIsland[]
  insights: ScanInsight[]
  loves: string[]
  avoids: string[]
  /** 0 = tiszta mainstream, 100 = tiszta niche */
  nicheScore: number
  constellation: ConstellationNode[]
  edges: [number, number][]
}

/** Ennyi listaelem alatt nem allitunk semmit — inkabb semmi, mint vaktipp. */
export const MIN_SCAN_SAMPLE = 10

/** A sziget-kuszob: ez alatt egy mufaj zaj, nem iranyzat. */
const ISLAND_MIN_SHARE = 0.06
/**
 * Ket mufaj ugyanaz a sziget, ha a KISEBBIK cimeinek ennyi resze a nagyobbikban
 * is benne van. Szandekosan tartalmazas es nem Jaccard: egy cimen atlagosan
 * negy mufaj all, ezert egy 27%-os Sci-Fi es egy 66%-os Action Jaccardja alacsony
 * marad akkor is, ha a Sci-Fi cimek 90%-a egyben Action is. Az utobbi viszont
 * pontosan azt jelenti, hogy a Sci-Fi nem kulon sziget, hanem az Action szarnya.
 */
const ISLAND_MERGE_CONTAINMENT = 0.6
const MAX_ISLANDS = 5
/** E folott a fosziget MAGA a lista, es nem a szigetek szama a mondanivalo. */
export const DOMINANT_ISLAND_SHARE = 0.75
/** A szignatura-allitashoz ennyi pontozott cim kell. */
export const MIN_SIGNATURE_RATED = 20
/** Ez alatti lift meg nem allitas. */
const MIN_SIGNATURE_LIFT = 1.5
const MAX_CONSTELLATION = 40
const MAX_EDGES = 70
/** Ket cim kozott akkor huzunk elt, ha ennyi mufajt osztanak. */
const EDGE_MIN_SHARED_GENRES = 2
/** 1/φ — alacsony diszkrepanciaju leptek a csillagkep szogosztasahoz. */
const GOLDEN_FRACTION = 0.618033988749895

/**
 * AniList-felhasznalonev alakja. A scan bejelentkezes nelkuli, publikus vegpont,
 * ezert a bemenet mar itt szuk: ami nem fer ebbe, az el sem jut az AniListig.
 */
export function isValidAnilistUsername(name: unknown): name is string {
  return typeof name === 'string' && /^[A-Za-z0-9_]{2,20}$/.test(name)
}

/** A statusz onmagaban is jel: amit befejeztel, azt vegignezted; amit dobtal, nem. */
const STATUS_WEIGHT: Record<string, number> = {
  COMPLETED: 0.35, CURRENT: 0.3, REPEATING: 0.6, PLANNING: 0.05, PAUSED: -0.1, DROPPED: -0.8,
}

/** A pont eros jel, a statusz gyenge. A 0 pont az AniList-nel „nincs pont". */
export function entryWeight(e: ScanEntry): number {
  if (e.score != null && e.score > 0) return (e.score - 5.5) / 4.5
  return STATUS_WEIGHT[e.status] ?? 0
}

function genreTitles(entries: ScanEntry[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>()
  for (const e of entries) {
    for (const g of e.genres) {
      const set = map.get(g) ?? new Set<number>()
      set.add(e.anilistId)
      map.set(g, set)
    }
  }
  return map
}

function containment(a: Set<number>, b: Set<number>): number {
  let shared = 0
  for (const id of a) if (b.has(id)) shared++
  const smaller = Math.min(a.size, b.size)
  return smaller === 0 ? 0 : shared / smaller
}

/**
 * Ízlés-szigetek: erosen fedo mufajokat egybe olvasztunk, mert a „Action +
 * Adventure + Fantasy" nem harom kulon erdeklodes, hanem egy. A megmarado
 * szigetek szama az, ami valoban mond valamit a listarol.
 */
export function buildIslands(entries: ScanEntry[]): TasteIsland[] {
  if (entries.length === 0) return []
  const byGenre = genreTitles(entries)
  const ranked = [...byGenre.entries()]
    .filter(([, ids]) => ids.size / entries.length >= ISLAND_MIN_SHARE)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))

  // A sziget MAGJAHOZ merunk, nem a novekvo unciojahoz. Kulonben lancolas lep
  // fel: a legnagyobb mufaj felszivja a masodikat, az igy megnott halmazba mar
  // a harmadik is belefer, es a vegen egyetlen 99%-os „sziget" marad, ami
  // semmit nem mond a listarol.
  const clusters: { name: string; members: string[]; seed: Set<number>; ids: Set<number> }[] = []
  for (const [genre, ids] of ranked) {
    const host = clusters.find((c) => containment(c.seed, ids) >= ISLAND_MERGE_CONTAINMENT)
    if (host) {
      host.members.push(genre)
      for (const id of ids) host.ids.add(id)
    } else {
      clusters.push({ name: genre, members: [], seed: new Set(ids), ids: new Set(ids) })
    }
  }

  return clusters
    .sort((a, b) => b.ids.size - a.ids.size || a.name.localeCompare(b.name))
    .slice(0, MAX_ISLANDS)
    .map((c) => ({
      name: c.name,
      members: c.members,
      count: c.ids.size,
      share: Math.round((c.ids.size / entries.length) * 100) / 100,
    }))
}

/**
 * Mainstream–niche: a listad cimeinek nezettsege, log-skalan. A kozossegi PONT
 * itt szandekosan nem szamit — egy magasra ertekelt cim lehet teljesen ismeretlen.
 * Median, nem atlag: ket Naruto-meretu cim ne mossa el az egesz listat.
 */
export function nicheScore(entries: ScanEntry[]): number {
  const pops = entries.map((e) => e.popularity).filter((p): p is number => p != null && p > 0)
  if (pops.length === 0) return 50
  const mainstreamness = pops
    .map((p) => Math.min(1, Math.max(0, (Math.log10(p) - 3) / 2.5)))
    .sort((a, b) => a - b)
  const mid = Math.floor(mainstreamness.length / 2)
  const median = mainstreamness.length % 2
    ? mainstreamness[mid]
    : (mainstreamness[mid - 1] + mainstreamness[mid]) / 2
  return Math.round(100 - median * 100)
}

/**
 * Szignatura-jel: az a tag, ami a magasra ertekelt cimeidben aranyaiban sokkal
 * gyakoribb, mint az alacsonyra ertekeltekben. A „lift" a sajat listadon belul
 * ertelmezett — nem allitunk semmit arrol, mas felhasznalok mit szeretnek.
 */
export function signatureFeature(entries: ScanEntry[]): { feature: string; lift: number } | null {
  // Szigorubb kuszob, mint a tobbi allitasnal: a lift egy harmadolt mintan
  // szuletik, es 20 pontozott cim alatt a felso harmad mar csak par cim —
  // ott egy 1,4-szeres arany veletlen, nem szignatura.
  const rated = entries.filter((e) => e.score != null && e.score > 0)
  if (rated.length < MIN_SIGNATURE_RATED) return null
  const sorted = [...rated].sort((a, b) => b.score! - a.score!)
  const cut = Math.max(3, Math.floor(sorted.length / 3))
  const top = sorted.slice(0, cut)
  const bottom = sorted.slice(-cut)

  const freq = (list: ScanEntry[]) => {
    const m = new Map<string, number>()
    for (const e of list) {
      // csak az erosen jelolt tagek: a rank 60 alattiak tul zajosak
      for (const t of e.tags.filter((t) => t.rank >= 60)) m.set(t.name, (m.get(t.name) ?? 0) + 1)
    }
    return m
  }
  const hi = freq(top)
  const lo = freq(bottom)

  let best: { feature: string; lift: number } | null = null
  for (const [name, n] of hi) {
    if (n < 3) continue // harom talalat alatt veletlen
    // Ket arany hanyadosa. +1 simitas a nevezoben: nelkule minden olyan tag,
    // ami a lista aljan egyszer sem fordul elo, vegtelen liftet kapna.
    const hiRate = n / top.length
    const loRate = ((lo.get(name) ?? 0) + 1) / (bottom.length + 1)
    const lift = hiRate / loRate
    if (!best || lift > best.lift || (lift === best.lift && name < best.feature)) {
      best = { feature: name, lift: Math.round(lift * 10) / 10 }
    }
  }
  return best && best.lift >= MIN_SIGNATURE_LIFT ? best : null
}

/** Szigorubb vagy engedekenyebb vagy a kozossegnel? Csak pontozott cimekbol. */
export function ratingBias(entries: ScanEntry[]): { direction: 'harsh' | 'generous'; delta: number } | null {
  const pairs = entries.filter((e) => e.score != null && e.score > 0 && e.averageScore != null)
  if (pairs.length < MIN_SCAN_SAMPLE) return null
  const sum = pairs.reduce((acc, e) => acc + (e.score! * 10 - e.averageScore!), 0)
  const delta = Math.round((sum / pairs.length) * 10) / 10
  if (Math.abs(delta) < 3) return null // ennel kisebb elteres nem allitas, hanem zaj
  return { direction: delta < 0 ? 'harsh' : 'generous', delta: Math.abs(delta) }
}

export function topStudio(entries: ScanEntry[]): { studio: string; count: number; share: number } | null {
  const liked = entries.filter((e) => entryWeight(e) > 0 && e.studio)
  if (liked.length < MIN_SCAN_SAMPLE) return null
  const counts = new Map<string, number>()
  for (const e of liked) counts.set(e.studio!, (counts.get(e.studio!) ?? 0) + 1)
  const [studio, count] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  if (count < 3) return null
  return { studio, count, share: Math.round((count / liked.length) * 100) / 100 }
}

/** Erosen kedvelt es erosen kerult mufajok, sulyozott atlag alapjan. */
export function lovesAndAvoids(entries: ScanEntry[]): { loves: string[]; avoids: string[] } {
  const acc = new Map<string, { sum: number; n: number }>()
  for (const e of entries) {
    const w = entryWeight(e)
    if (w === 0) continue
    for (const g of e.genres) {
      const cur = acc.get(g) ?? { sum: 0, n: 0 }
      acc.set(g, { sum: cur.sum + w, n: cur.n + 1 })
    }
  }
  // A kuszob a listahoz meretezodik: harom sportcim egy 400 cimes listan nem
  // teszi a sportot azza, „amit keresel". Kis listan viszont a harom eleg.
  const minTitles = Math.max(3, Math.ceil(entries.length * 0.02))
  const scored = [...acc.entries()]
    .filter(([, v]) => v.n >= minTitles)
    .map(([name, v]) => ({ name, avg: v.sum / v.n }))
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name))
  return {
    loves: scored.filter((s) => s.avg > 0.15).slice(0, 3).map((s) => s.name),
    avoids: scored.filter((s) => s.avg < -0.15).slice(-2).reverse().map((s) => s.name),
  }
}

/**
 * A megjelenitendo harom allitas. Determinisztikus sorrend: eloszor az, ami a
 * legtobbet mondja a listarol, es amit a MAL/AniList sajat statisztikaja nem
 * mutat meg. A szigetek szama vezet, mert az a scan sajat allitasa.
 */
export function pickInsights(entries: ScanEntry[], islands: TasteIsland[]): ScanInsight[] {
  const out: ScanInsight[] = []
  if (islands.length > 0) {
    // Egy 88%-os fosziget mellett a „4 kulon sziged van" felrevezeto: a lista
    // valojaban egy tomb, par kis kinyulassal. Ezt kimondani tobbet er.
    const dominant = islands[0].share >= DOMINANT_ISLAND_SHARE ? islands[0].name : undefined
    out.push({ kind: 'islands', count: islands.length, names: islands.map((i) => i.name), dominant })
  }
  const sig = signatureFeature(entries)
  if (sig) out.push({ kind: 'signature', ...sig })
  const studio = topStudio(entries)
  if (studio) out.push({ kind: 'topStudio', ...studio })
  const bias = ratingBias(entries)
  if (bias) out.push({ kind: 'rating', ...bias })
  const niche = nicheScore(entries)
  if (niche >= 60 || niche <= 35) out.push({ kind: 'niche', score: niche })
  return out.slice(0, 3)
}

/**
 * Reszleges „graf": determinisztikus csillagkep-elrendezes. Nem fizikai szimulacio
 * — az a 3D-grafe, ami a regisztracio mogott van. A sziget adja a szoget, a
 * kedveltseg a sugarat: ami kozel van a kozepehez, azt szereted a legjobban.
 */
export function buildConstellation(
  entries: ScanEntry[],
  islands: TasteIsland[],
): { constellation: ConstellationNode[]; edges: [number, number][] } {
  const islandOf = new Map<string, number>()
  islands.forEach((isl, i) => {
    for (const g of [isl.name, ...isl.members]) islandOf.set(g, i)
  })

  const ranked = entries
    .map((e) => ({ e, w: entryWeight(e) }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || a.e.anilistId - b.e.anilistId)
    .slice(0, MAX_CONSTELLATION)
  if (ranked.length === 0) return { constellation: [], edges: [] }

  // Ket menet. Eloszor szigetenkent csoportositunk, mert csak a teljes csoport
  // ismereteben lehet aranyos korcikket adni neki: fix szog-lepessel a nagy
  // sziget csomoba all, a kicsi meg szetszorodik.
  const lanes = Math.max(1, islands.length)
  const laneOf = (e: ScanEntry) => e.genres.map((g) => islandOf.get(g)).find((i) => i != null) ?? lanes
  const groups = new Map<number, { e: ScanEntry; w: number }[]>()
  for (const item of ranked) {
    const idx = laneOf(item.e)
    const g = groups.get(idx) ?? []
    g.push(item)
    groups.set(idx, g)
  }

  const placed = new Map<number, ConstellationNode>()
  let cursor = 0
  for (const idx of [...groups.keys()].sort((a, b) => a - b)) {
    const group = groups.get(idx)!
    const sector = (group.length / ranked.length) * Math.PI * 2
    const start = cursor
    cursor += sector
    group.forEach(({ e, w }, k) => {
      // Napraforgo-elrendezes a sziget korcikkeben. Ket dolgot kell egyszerre
      // teljesitenie, es a naiv megoldasok mindig az egyiket rontjak el:
      //   - a sugar sulybol szamolva gyurut ad, mert egy csomo cim ugyanaz a 10-es;
      //   - a sugar rangbol, egyenletes szoggel viszont ivet ad, mert a ketto
      //     egyutt no, es a korcikk belseje ures marad.
      // A gyokos sugar teruletre nezve egyenletesen tolt, az aranymetszet-lepteku
      // szog pedig szethuzza az egymas utani elemeket. A sorrend igy is szamit:
      // a `ranked` suly szerinti, tehat a kedvencek a kozeppont korul allnak.
      const t = (k + 0.5) / group.length
      const angle = start + sector * ((k * GOLDEN_FRACTION) % 1)
      const radius = Math.min(1, 0.14 + Math.sqrt(t) * 0.8)
      placed.set(e.anilistId, {
        anilistId: e.anilistId,
        title: e.title,
        coverUrl: e.coverUrl,
        island: islands[idx]?.name ?? 'other',
        x: Math.round(Math.cos(angle) * radius * 1000) / 1000,
        y: Math.round(Math.sin(angle) * radius * 1000) / 1000,
        r: Math.round(Math.min(1, Math.max(0.25, w)) * 1000) / 1000,
      })
    })
  }
  // az elek a `ranked` indexeire hivatkoznak, ezert a sorrend nem valtozhat
  const constellation: ConstellationNode[] = ranked.map(({ e }) => placed.get(e.anilistId)!)

  // Eloszor MINDEN el, aztan a legerosebbek maradnak. Ha menet kozben vagnank,
  // a lista elejen allo csomopontok kapnak minden elt, a vegen allok egyet sem.
  const candidates: { pair: [number, number]; shared: number }[] = []
  for (let i = 0; i < constellation.length; i++) {
    const a = new Set(ranked[i].e.genres)
    for (let j = i + 1; j < constellation.length; j++) {
      const shared = ranked[j].e.genres.filter((g) => a.has(g)).length
      if (shared >= EDGE_MIN_SHARED_GENRES) candidates.push({ pair: [i, j], shared })
    }
  }
  const edges = candidates
    .sort((x, y) => y.shared - x.shared || x.pair[0] - y.pair[0] || x.pair[1] - y.pair[1])
    .slice(0, MAX_EDGES)
    .map((c) => c.pair)
  return { constellation, edges }
}

/** null = tul keves adat ahhoz, hogy barmit allitsunk. */
export function scanTaste(entries: ScanEntry[]): ScanResult | null {
  const usable = entries.filter((e) => e.genres.length > 0)
  if (usable.length < MIN_SCAN_SAMPLE) return null
  const islands = buildIslands(usable)
  const { constellation, edges } = buildConstellation(usable, islands)
  const { loves, avoids } = lovesAndAvoids(usable)
  return {
    sample: usable.length,
    rated: usable.filter((e) => e.score != null && e.score > 0).length,
    islands,
    insights: pickInsights(usable, islands),
    loves,
    avoids,
    nicheScore: nicheScore(usable),
    constellation,
    edges,
  }
}
