import { describe, it, expect } from 'vitest'
import {
  buildCharacterLayer, buildGhostLayer, buildGraph, buildStaffLayer, filterByMedia, scoreBand,
  type GhostPick, type GraphAnime,
} from './graph-builder'

const mk = (over: Partial<GraphAnime>): GraphAnime => ({
  id: 1, anilistId: 100, titleRomaji: 'A', coverUrl: null,
  genres: ['Action'], studio: 'MAPPA', year: 2020, status: 'completed',
  myScore: 8, relations: [], ...over,
})

describe('buildCharacterLayer', () => {
  const favs = [
    { charId: 1, name: 'Lelouch', image: null, vaId: 95270, vaName: 'Fukuyama Jun', animeId: 10 },
    { charId: 2, name: 'Ichigo', image: null, vaId: 95270, vaName: 'Fukuyama Jun', animeId: 20 },
    { charId: 3, name: 'Levi', image: null, vaId: 95100, vaName: 'Kamiya Hiroshi', animeId: 30 },
  ]
  it('char-node + él a saját animéhez, csak látható animékre', () => {
    const { nodes, links } = buildCharacterLayer(favs, new Set([10, 20]))
    expect(nodes.map((n) => n.id)).toEqual(['char:1', 'char:2'])
    expect(links).toContainEqual({ source: 'anime:10', target: 'char:1', kind: 'char' })
  })
  it('azonos vaId → seiyuu-keresztél egyszer', () => {
    const { links } = buildCharacterLayer(favs, new Set([10, 20, 30]))
    const seiyuu = links.filter((l) => l.kind === 'seiyuu')
    expect(seiyuu).toEqual([{ source: 'char:1', target: 'char:2', kind: 'seiyuu' }])
  })
  it('vaId nélkül nincs keresztél', () => {
    const { links } = buildCharacterLayer([{ ...favs[0], vaId: null }], new Set([10]))
    expect(links.filter((l) => l.kind === 'seiyuu')).toHaveLength(0)
  })
})

describe('filterByMedia', () => {
  it('szűr mediaType-ra, ALL mindent visszaad', () => {
    const rows = [{ mediaType: 'ANIME' }, { mediaType: 'MANGA' }, { mediaType: 'ANIME' }]
    expect(filterByMedia(rows, 'ANIME')).toHaveLength(2)
    expect(filterByMedia(rows, 'MANGA')).toHaveLength(1)
    expect(filterByMedia(rows, 'ALL')).toHaveLength(3)
  })
})

describe('scoreBand', () => {
  it('bands scores', () => {
    expect(scoreBand(3)).toBe('1–4')
    expect(scoreBand(5)).toBe('5–6')
    expect(scoreBand(8)).toBe('7–8')
    expect(scoreBand(10)).toBe('9–10')
    expect(scoreBand(null)).toBe('No score')
  })
})

describe('buildGraph', () => {
  it('builds genre → studio → anime chain with path-scoped dim ids', () => {
    const rows = [
      mk({ id: 1, anilistId: 100, studio: 'MAPPA' }),
      mk({ id: 2, anilistId: 200, titleRomaji: 'B', studio: 'Bones' }),
    ]
    const g = buildGraph(rows, { levels: ['genre', 'studio'], crossLinks: false })
    const ids = g.nodes.map((n) => n.id).sort()
    expect(ids).toEqual([
      'anime:1', 'anime:2',
      'dim:genre:Action', 'dim:studio:Action/Bones', 'dim:studio:Action/MAPPA',
    ].sort())
    expect(g.links).toContainEqual({ source: 'dim:genre:Action', target: 'dim:studio:Action/MAPPA', kind: 'chain' })
    expect(g.links).toContainEqual({ source: 'dim:studio:Action/MAPPA', target: 'anime:1', kind: 'chain' })
    expect(g.links).toHaveLength(4)
  })

  it('same studio under different genres yields separate dim nodes (tree, not web)', () => {
    const rows = [
      mk({ id: 1, genres: ['Action'] }),
      mk({ id: 2, anilistId: 200, genres: ['Drama'] }),
    ]
    const g = buildGraph(rows, { levels: ['genre', 'studio'], crossLinks: false })
    const studioNodes = g.nodes.filter((n) => n.dim === 'studio')
    expect(studioNodes.map((n) => n.id).sort()).toEqual(['dim:studio:Action/MAPPA', 'dim:studio:Drama/MAPPA'])
    expect(studioNodes.every((n) => n.label === 'MAPPA')).toBe(true)
  })

  it('empty levels → only anime nodes, no chain links', () => {
    const g = buildGraph([mk({})], { levels: [], crossLinks: false })
    expect(g.nodes).toHaveLength(1)
    expect(g.links).toHaveLength(0)
  })

  it('crossLinks adds deduped relation edges only between owned anime', () => {
    const rows = [
      mk({ id: 1, anilistId: 100, relations: [{ type: 'SEQUEL', anilistId: 200 }] }),
      mk({ id: 2, anilistId: 200, titleRomaji: 'B', relations: [{ type: 'PREQUEL', anilistId: 100 }] }),
      mk({ id: 3, anilistId: 300, titleRomaji: 'C', relations: [{ type: 'SEQUEL', anilistId: 999 }] }),
    ]
    const g = buildGraph(rows, { levels: [], crossLinks: true })
    const rel = g.links.filter((l) => l.kind === 'relation')
    expect(rel).toEqual([{ source: 'anime:1', target: 'anime:2', kind: 'relation' }])
  })

  it('anime with no genre falls into the unknown bucket', () => {
    const g = buildGraph([mk({ genres: [] })], { levels: ['genre'], crossLinks: false })
    expect(g.nodes.some((n) => n.id === 'dim:genre:Unknown')).toBe(true)
  })

  it('a csoport-cimke a beadott szotarbol jon, nem beegetve', () => {
    // A node ID-ja a cimkebol kepzodik, ezert a forditast a builder kapja.
    const labels = { unknown: 'Ismeretlen', noScore: 'Nincs pont', status: { watching: 'Nézem' } }
    const g = buildGraph([mk({ genres: [] })], { levels: ['genre'], crossLinks: false }, labels)
    expect(g.nodes.some((n) => n.id === 'dim:genre:Ismeretlen')).toBe(true)
  })
})

describe('buildStaffLayer', () => {
  const rows = [
    { staffId: 100, name: 'Rendező A', image: null, animeId: 1 },
    { staffId: 100, name: 'Rendező A', image: null, animeId: 2 },
    { staffId: 200, name: 'Rendező B', image: null, animeId: 3 },
  ]

  it('egy staff-node több animéhez kötve (a közös node maga a kereszt-kapcsolat)', () => {
    const { nodes, links } = buildStaffLayer(rows, new Set([1, 2, 3]))
    expect(nodes).toHaveLength(2)
    expect(links.filter((l) => l.source === 'anime:1' || l.source === 'anime:2')).toHaveLength(2)
    expect(links.every((l) => l.kind === 'char')).toBe(true)
  })

  it('nem látható animék staffja kimarad, árva node sincs', () => {
    const { nodes, links } = buildStaffLayer(rows, new Set([3]))
    expect(nodes.map((n) => n.id)).toEqual(['staff:200'])
    expect(links).toHaveLength(1)
  })
})

describe('buildGhostLayer', () => {
  const pick = (over: Partial<GhostPick> = {}): GhostPick => ({
    anilistId: 500, title: 'Ghost', coverUrl: null, genres: ['Action'],
    score: 78, reason: 'ezeket szereted: Action', ...over,
  })

  it('a legtobb kozos mufaju sajat cimhez koti', () => {
    const visible = [mk({ id: 1, titleRomaji: 'Akcio', genres: ['Action'] }),
      mk({ id: 2, titleRomaji: 'Romi', genres: ['Romance'] })]
    const { nodes, links } = buildGhostLayer([pick()], visible)
    expect(nodes[0]).toMatchObject({ id: 'ghost:500', type: 'ghost', anchorLabel: 'Akcio' })
    expect(links).toEqual([{ source: 'anime:1', target: 'ghost:500', kind: 'ghost' }])
  })

  it('dontetlennel a jobbra ertekelt sajat cim a horgony', () => {
    const visible = [mk({ id: 1, titleRomaji: 'Gyenge', genres: ['Action'], myScore: 4 }),
      mk({ id: 2, titleRomaji: 'Kedvenc', genres: ['Action'], myScore: 10 })]
    expect(buildGhostLayer([pick()], visible).nodes[0].anchorLabel).toBe('Kedvenc')
  })

  it('horgony nelkuli ajanlas kimarad — a megmagyarazhatatlan ajanlas rosszabb a semminel', () => {
    const visible = [mk({ id: 1, genres: ['Romance'] })]
    expect(buildGhostLayer([pick({ genres: ['Mecha'] })], visible)).toEqual({ nodes: [], links: [] })
  })

  it('ures lathato halmazon nem tesz ki semmit', () => {
    expect(buildGhostLayer([pick()], [])).toEqual({ nodes: [], links: [] })
  })

  it('legfeljebb a megadott darabszamot adja', () => {
    const visible = [mk({ id: 1, genres: ['Action'] })]
    const picks = Array.from({ length: 12 }, (_, i) => pick({ anilistId: 600 + i }))
    expect(buildGhostLayer(picks, visible, 3).nodes).toHaveLength(3)
  })

  it('az indoklast es a pontszamot atviszi a node-ra', () => {
    const visible = [mk({ id: 1, genres: ['Action'] })]
    const n = buildGhostLayer([pick({ score: 91, reason: 'mert' })], visible).nodes[0]
    expect(n).toMatchObject({ fitScore: 91, reason: 'mert', anilistId: 500 })
  })
})
