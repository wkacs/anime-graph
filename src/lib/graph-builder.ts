export type Dimension = 'genre' | 'studio' | 'scoreBand' | 'year' | 'status'

export type CoverMode = 'auto' | 'on' | 'off'

export type GraphConfig = {
  levels: Dimension[]
  crossLinks: boolean
  // node detail: 'auto' shows covers+names only under the perf threshold
  covers?: CoverMode
}

export const DEFAULT_CONFIG: GraphConfig = {
  levels: ['genre', 'studio'],
  crossLinks: true,
  covers: 'auto',
}

// above this many anime nodes 'auto' drops covers/labels for plain dots
export const COVER_AUTO_LIMIT = 80

export const ALL_DIMENSIONS: Dimension[] = ['genre', 'studio', 'scoreBand', 'year', 'status']

export type MediaMode = 'ANIME' | 'MANGA' | 'ALL'

export function filterByMedia<T extends { mediaType: string }>(rows: T[], mode: MediaMode): T[] {
  return mode === 'ALL' ? rows : rows.filter((r) => r.mediaType === mode)
}

export type GraphAnime = {
  id: number
  anilistId: number
  titleRomaji: string
  coverUrl: string | null
  genres: string[]
  studio: string | null
  year: number | null
  status: string
  myScore: number | null
  relations: { type: string; anilistId: number }[]
  tags?: { name: string; rank: number }[]
}

export type GraphNode = {
  id: string
  /** `ghost`: NINCS a listadon — ajanlas, ami a graf szelen lebeg */
  type: 'dim' | 'anime' | 'char' | 'ghost'
  label: string
  // char-node: másodlagos felirat (seiyuu neve) a tooltiphez
  sub?: string
  img?: string
  val: number
  status?: string
  animeId?: number
  dim?: Dimension
  // timeline mode: pinned coordinates + year-marker flag
  fx?: number
  fy?: number
  fz?: number
  timeNode?: boolean
  // drill-down entry view: genre bubble sized by anime count
  bubble?: boolean
  // bubble decoration: top covers of the genre
  covers?: string[]
  // ghost-node: az ajanlott cim adatai (nincs sajat `anime.id`-ja, mert nincs a listan)
  anilistId?: number
  reason?: string
  fitScore?: number
  /** melyik listas cimhez kotottuk — a „miert pont ez?" valasza */
  anchorLabel?: string
}

export type GraphLink = {
  source: string
  target: string
  kind: 'chain' | 'relation' | 'vibe' | 'char' | 'seiyuu' | 'ghost'
}

/**
 * A csoport-node felirata EGYBEN az azonositoja is (`dim:genre:<label>`), ezert
 * a forditott szoveget be kell adni, nem lehet a megjelenitesnel racsavarni.
 * Alapertelmezes az angol, mert az app alapnyelve is az.
 */
export type GraphLabels = {
  unknown: string
  noScore: string
  status: Record<string, string>
}

export const DEFAULT_GRAPH_LABELS: GraphLabels = {
  unknown: 'Unknown',
  noScore: 'No score',
  status: { watching: 'Watching', completed: 'Completed', dropped: 'Dropped', planned: 'Plan to watch' },
}

export function scoreBand(s: number | null, labels: GraphLabels = DEFAULT_GRAPH_LABELS): string {
  if (s == null) return labels.noScore
  if (s <= 4) return '1–4'
  if (s <= 6) return '5–6'
  if (s <= 8) return '7–8'
  return '9–10'
}

function dimValue(a: GraphAnime, d: Dimension, labels: GraphLabels): string {
  switch (d) {
    case 'genre': return a.genres[0] ?? labels.unknown
    case 'studio': return a.studio ?? labels.unknown
    case 'scoreBand': return scoreBand(a.myScore, labels)
    case 'year': return a.year != null ? String(a.year) : labels.unknown
    case 'status': return labels.status[a.status] ?? a.status
  }
}

const RELATION_TYPES = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'PARENT', 'ALTERNATIVE'])

// drill-down entry view: one bubble per genre, sized by how many anime carry it,
// decorated with the genre's top-scored covers
export function buildBubbles(
  rows: GraphAnime[],
  labels: GraphLabels = DEFAULT_GRAPH_LABELS,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const byGenre = new Map<string, GraphAnime[]>()
  for (const a of rows) {
    const genres = a.genres.length ? a.genres : [labels.unknown]
    for (const g of genres) {
      const list = byGenre.get(g) ?? []
      list.push(a)
      byGenre.set(g, list)
    }
  }
  const nodes: GraphNode[] = [...byGenre.entries()].map(([genre, list]) => ({
    id: `dim:genre:${genre}`,
    type: 'dim',
    label: genre,
    val: list.length,
    dim: 'genre',
    bubble: true,
    covers: [...list]
      .filter((a) => a.coverUrl)
      .sort((x, y) => (y.myScore ?? 0) - (x.myScore ?? 0))
      .slice(0, 3)
      .map((a) => a.coverUrl!),
  }))
  return { nodes, links: [] }
}

// faint "same vibe" edges: enough shared tags, capped so it never becomes a hairball
const VIBE_MIN_SHARED = 3
const VIBE_MAX_PER_ANIME = 2

function vibeLinks(subset: GraphAnime[]): GraphLink[] {
  const tagSets = new Map<number, Set<string>>()
  for (const a of subset) {
    if (a.tags?.length) tagSets.set(a.id, new Set(a.tags.map((t) => t.name)))
  }
  const candidates: { a: number; b: number; shared: number }[] = []
  const items = [...tagSets.entries()]
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      let shared = 0
      for (const t of items[i][1]) if (items[j][1].has(t)) shared++
      if (shared >= VIBE_MIN_SHARED) candidates.push({ a: items[i][0], b: items[j][0], shared })
    }
  }
  candidates.sort((x, y) => y.shared - x.shared)
  const degree = new Map<number, number>()
  const links: GraphLink[] = []
  for (const c of candidates) {
    if ((degree.get(c.a) ?? 0) >= VIBE_MAX_PER_ANIME || (degree.get(c.b) ?? 0) >= VIBE_MAX_PER_ANIME) continue
    degree.set(c.a, (degree.get(c.a) ?? 0) + 1)
    degree.set(c.b, (degree.get(c.b) ?? 0) + 1)
    const [lo, hi] = c.a < c.b ? [c.a, c.b] : [c.b, c.a]
    links.push({ source: `anime:${lo}`, target: `anime:${hi}`, kind: 'vibe' })
  }
  return links
}

// drill-down detail: the chosen genre as hub + every anime tagged with it
export function buildGenreDetail(
  rows: GraphAnime[],
  genre: string,
  labels: GraphLabels = DEFAULT_GRAPH_LABELS,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const subset = rows.filter((a) =>
    genre === labels.unknown ? a.genres.length === 0 : a.genres.includes(genre),
  )
  const hubId = `dim:genre:${genre}`
  const nodes: GraphNode[] = [
    { id: hubId, type: 'dim', label: genre, val: 12, dim: 'genre' },
  ]
  const links: GraphLink[] = []
  for (const a of subset) {
    nodes.push({
      id: `anime:${a.id}`,
      type: 'anime',
      label: a.titleRomaji,
      img: a.coverUrl ?? undefined,
      val: a.myScore ?? 5,
      status: a.status,
      animeId: a.id,
    })
    links.push({ source: hubId, target: `anime:${a.id}`, kind: 'chain' })
  }
  const byAnilist = new Map(subset.map((a) => [a.anilistId, a.id]))
  const seen = new Set<string>()
  for (const a of subset) {
    for (const rel of a.relations) {
      if (!RELATION_TYPES.has(rel.type)) continue
      const targetId = byAnilist.get(rel.anilistId)
      if (targetId === undefined || targetId === a.id) continue
      const [lo, hi] = a.id < targetId ? [a.id, targetId] : [targetId, a.id]
      const key = `${lo}|${hi}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ source: `anime:${lo}`, target: `anime:${hi}`, kind: 'relation' })
    }
  }
  links.push(...vibeLinks(subset))
  return { nodes, links }
}

export type GhostPick = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  score: number
  reason: string
}

/** Ennyi ajanlas lebeg egyszerre a grafon. Tobb mar zaj, nem meghivas. */
export const MAX_GHOSTS = 5
/** Enne1 kevesebb kozos mufajnal nem huzunk elt — a veletlen kapcsolat rosszabb a semminel. */
const GHOST_MIN_SHARED_GENRES = 1

/**
 * Ghost-node-ok: cimek, amik NINCSENEK a listadon, de a jelenlegi nezet mellett
 * allnak. Mindegyik ahhoz a LATHATO sajat cimedhez kotodik, amivel a legtobb
 * mufajt osztja — ez adja a „miert pont ez?" valaszat, es ez teszi a grafot
 * dontesi feluletté ahelyett, hogy egyszeri latvany maradna.
 *
 * Amihez nem talalunk horgonyt a lathato halmazban, az kimarad: a semmibol logo
 * ajanlas nem magyarazhato, tehat nem is ér semmit.
 */
export function buildGhostLayer(
  picks: GhostPick[],
  visible: GraphAnime[],
  max = MAX_GHOSTS,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  if (!visible.length) return { nodes, links }

  for (const p of picks) {
    if (nodes.length >= max) break
    const pickGenres = new Set(p.genres)
    let anchor: GraphAnime | null = null
    let best = 0
    for (const a of visible) {
      const shared = a.genres.filter((g) => pickGenres.has(g)).length
      // dontetlennel a jobbra ertekelt sajat cim nyer: onnan hihetobb az atvezetes
      if (shared > best || (shared === best && shared > 0 && (a.myScore ?? 0) > (anchor?.myScore ?? 0))) {
        best = shared
        anchor = a
      }
    }
    if (!anchor || best < GHOST_MIN_SHARED_GENRES) continue

    const id = `ghost:${p.anilistId}`
    nodes.push({
      id,
      type: 'ghost',
      label: p.title,
      img: p.coverUrl ?? undefined,
      val: 4,
      anilistId: p.anilistId,
      reason: p.reason,
      fitScore: p.score,
      anchorLabel: anchor.titleRomaji,
    })
    links.push({ source: `anime:${anchor.id}`, target: id, kind: 'ghost' })
  }
  return { nodes, links }
}

export type FavChar = {
  charId: number
  name: string
  image: string | null
  vaId: number | null
  vaName: string | null
  animeId: number
}

// kedvenc karakterek a látható anime-node-jaikhoz kötve + same-seiyuu keresztélek
export function buildCharacterLayer(favs: FavChar[], visibleAnimeIds: Set<number>): { nodes: GraphNode[]; links: GraphLink[] } {
  const visible = favs.filter((f) => visibleAnimeIds.has(f.animeId))
  const nodes: GraphNode[] = visible.map((f) => ({
    id: `char:${f.charId}`,
    type: 'char',
    label: f.name,
    sub: f.vaName ?? undefined,
    img: f.image ?? undefined,
    val: 3,
  }))
  const links: GraphLink[] = visible.map((f) => ({
    source: `anime:${f.animeId}`, target: `char:${f.charId}`, kind: 'char' as const,
  }))
  const byVa = new Map<number, FavChar[]>()
  for (const f of visible) {
    if (f.vaId == null) continue
    const list = byVa.get(f.vaId) ?? []
    list.push(f)
    byVa.set(f.vaId, list)
  }
  for (const group of byVa.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [lo, hi] = group[i].charId < group[j].charId
          ? [group[i].charId, group[j].charId] : [group[j].charId, group[i].charId]
        links.push({ source: `char:${lo}`, target: `char:${hi}`, kind: 'seiyuu' })
      }
    }
  }
  return { nodes, links }
}

export type StaffRow = { staffId: number; name: string; image: string | null; animeId: number }

// rendezők a látható animéikhez kötve; ugyanaz a rendező több animénél = közös node,
// ami maga adja a kereszt-kapcsolatot (külön él nem kell)
export function buildStaffLayer(rows: StaffRow[], visibleAnimeIds: Set<number>): { nodes: GraphNode[]; links: GraphLink[] } {
  const visible = rows.filter((r) => visibleAnimeIds.has(r.animeId))
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  for (const r of visible) {
    const id = `staff:${r.staffId}`
    if (!nodes.has(id)) {
      nodes.set(id, { id, type: 'char', label: r.name, sub: 'rendező', img: r.image ?? undefined, val: 3 })
    }
    links.push({ source: `anime:${r.animeId}`, target: id, kind: 'char' })
  }
  return { nodes: [...nodes.values()], links }
}

export type TimelineAnime = GraphAnime & { watchedAt: string | null; createdAt: string }

const SPACING = 42

// chronological layout: anime pinned along the x axis by watch date,
// small deterministic y/z jitter so covers don't overlap, year markers above
export function buildTimeline(rows: TimelineAnime[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const dated = rows
    .map((a) => ({ a, t: new Date(a.watchedAt ?? a.createdAt).getTime() }))
    .sort((x, y) => x.t - y.t)

  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  let lastYear: number | null = null

  dated.forEach(({ a, t }, i) => {
    const fx = i * SPACING
    const year = new Date(t).getFullYear()
    if (year !== lastYear) {
      lastYear = year
      nodes.push({
        id: `time:${year}:${i}`,
        type: 'dim',
        label: String(year),
        val: 0,
        timeNode: true,
        fx,
        fy: 42,
        fz: 0,
      })
    }
    nodes.push({
      id: `anime:${a.id}`,
      type: 'anime',
      label: a.titleRomaji,
      img: a.coverUrl ?? undefined,
      val: a.myScore ?? 5,
      status: a.status,
      animeId: a.id,
      fx,
      fy: ((a.id * 37) % 5 - 2) * 5,
      fz: ((a.id * 17) % 5 - 2) * 5,
    })
  })

  const byAnilist = new Map(rows.map((a) => [a.anilistId, a.id]))
  const seen = new Set<string>()
  for (const a of rows) {
    for (const rel of a.relations) {
      if (!RELATION_TYPES.has(rel.type)) continue
      const targetId = byAnilist.get(rel.anilistId)
      if (targetId === undefined || targetId === a.id) continue
      const [lo, hi] = a.id < targetId ? [a.id, targetId] : [targetId, a.id]
      const key = `${lo}|${hi}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ source: `anime:${lo}`, target: `anime:${hi}`, kind: 'relation' })
    }
  }

  return { nodes, links }
}

export function buildGraph(
  rows: GraphAnime[],
  cfg: GraphConfig,
  labels: GraphLabels = DEFAULT_GRAPH_LABELS,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const linkSeen = new Set<string>()

  const addLink = (source: string, target: string, kind: GraphLink['kind']) => {
    const key = `${kind}|${source}|${target}`
    if (linkSeen.has(key)) return
    linkSeen.add(key)
    links.push({ source, target, kind })
  }

  for (const a of rows) {
    const animeNodeId = `anime:${a.id}`
    nodes.set(animeNodeId, {
      id: animeNodeId,
      type: 'anime',
      label: a.titleRomaji,
      img: a.coverUrl ?? undefined,
      val: a.myScore ?? 5,
      status: a.status,
      animeId: a.id,
    })

    let prevId: string | null = null
    const path: string[] = []
    for (const level of cfg.levels) {
      const value = dimValue(a, level, labels)
      path.push(value)
      const dimId = `dim:${level}:${path.join('/')}`
      if (!nodes.has(dimId)) {
        nodes.set(dimId, { id: dimId, type: 'dim', label: value, val: 12, dim: level })
      }
      if (prevId) addLink(prevId, dimId, 'chain')
      prevId = dimId
    }
    if (prevId) addLink(prevId, animeNodeId, 'chain')
  }

  if (cfg.crossLinks) {
    const byAnilist = new Map(rows.map((a) => [a.anilistId, a.id]))
    for (const a of rows) {
      for (const rel of a.relations) {
        if (!RELATION_TYPES.has(rel.type)) continue
        const targetId = byAnilist.get(rel.anilistId)
        if (targetId === undefined || targetId === a.id) continue
        const [lo, hi] = a.id < targetId ? [a.id, targetId] : [targetId, a.id]
        addLink(`anime:${lo}`, `anime:${hi}`, 'relation')
      }
    }
  }

  return { nodes: [...nodes.values()], links }
}
