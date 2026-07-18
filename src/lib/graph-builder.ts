export type Dimension = 'genre' | 'studio' | 'scoreBand' | 'year' | 'status'

export type CoverMode = 'auto' | 'on' | 'off'

export type GraphConfig = {
  levels: Dimension[]
  crossLinks: boolean
  sizeBy: 'score' | 'elo'
  // node detail: 'auto' shows covers+names only under the perf threshold
  covers?: CoverMode
}

export const DEFAULT_CONFIG: GraphConfig = {
  levels: ['genre', 'studio'],
  crossLinks: true,
  sizeBy: 'score',
  covers: 'auto',
}

// above this many anime nodes 'auto' drops covers/labels for plain dots
export const COVER_AUTO_LIMIT = 80

export const DIM_LABELS: Record<Dimension, string> = {
  genre: 'Műfaj',
  studio: 'Stúdió',
  scoreBand: 'Pontszám-sáv',
  year: 'Év',
  status: 'Státusz',
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
  elo: number
  relations: { type: string; anilistId: number }[]
}

export type GraphNode = {
  id: string
  type: 'dim' | 'anime'
  label: string
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
}

export type GraphLink = { source: string; target: string; kind: 'chain' | 'relation' }

const STATUS_LABELS: Record<string, string> = {
  watching: 'Nézem',
  completed: 'Kész',
  dropped: 'Dropped',
  planned: 'Tervezem',
}

export function scoreBand(s: number | null): string {
  if (s == null) return 'Nincs pont'
  if (s <= 4) return '1–4'
  if (s <= 6) return '5–6'
  if (s <= 8) return '7–8'
  return '9–10'
}

function dimValue(a: GraphAnime, d: Dimension): string {
  switch (d) {
    case 'genre': return a.genres[0] ?? 'Ismeretlen'
    case 'studio': return a.studio ?? 'Ismeretlen'
    case 'scoreBand': return scoreBand(a.myScore)
    case 'year': return a.year != null ? String(a.year) : 'Ismeretlen'
    case 'status': return STATUS_LABELS[a.status] ?? a.status
  }
}

const RELATION_TYPES = new Set(['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'PARENT', 'ALTERNATIVE'])

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

export function buildGraph(rows: GraphAnime[], cfg: GraphConfig): { nodes: GraphNode[]; links: GraphLink[] } {
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
      val: cfg.sizeBy === 'elo' ? a.elo / 150 : (a.myScore ?? 5),
      status: a.status,
      animeId: a.id,
    })

    let prevId: string | null = null
    const path: string[] = []
    for (const level of cfg.levels) {
      const value = dimValue(a, level)
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
