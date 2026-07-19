import { describe, it, expect } from 'vitest'
import { buildGraph, filterByMedia, scoreBand, type GraphAnime } from './graph-builder'

const mk = (over: Partial<GraphAnime>): GraphAnime => ({
  id: 1, anilistId: 100, titleRomaji: 'A', coverUrl: null,
  genres: ['Action'], studio: 'MAPPA', year: 2020, status: 'completed',
  myScore: 8, relations: [], ...over,
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
    expect(scoreBand(null)).toBe('Nincs pont')
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

  it('anime with no genre falls into Ismeretlen', () => {
    const g = buildGraph([mk({ genres: [] })], { levels: ['genre'], crossLinks: false })
    expect(g.nodes.some((n) => n.id === 'dim:genre:Ismeretlen')).toBe(true)
  })
})
