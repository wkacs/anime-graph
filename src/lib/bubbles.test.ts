import { describe, it, expect } from 'vitest'
import { buildBubbles, buildGenreDetail, type GraphAnime } from './graph-builder'

const mk = (over: Partial<GraphAnime>): GraphAnime => ({
  id: 1, anilistId: 100, titleRomaji: 'A', coverUrl: null,
  genres: ['Action'], studio: 'MAPPA', year: 2020, status: 'completed',
  myScore: 8, elo: 1200, relations: [], ...over,
})

describe('buildBubbles', () => {
  it('creates one bubble per genre with anime counts (multi-genre counts everywhere)', () => {
    const rows = [
      mk({ id: 1, genres: ['Action', 'Drama'] }),
      mk({ id: 2, anilistId: 200, genres: ['Action'] }),
    ]
    const g = buildBubbles(rows)
    const action = g.nodes.find((n) => n.id === 'dim:genre:Action')!
    const drama = g.nodes.find((n) => n.id === 'dim:genre:Drama')!
    expect(action.val).toBe(2)
    expect(drama.val).toBe(1)
    expect(action.bubble).toBe(true)
    expect(g.links).toHaveLength(0)
  })

  it('anime without genre lands in Ismeretlen bubble', () => {
    const g = buildBubbles([mk({ genres: [] })])
    expect(g.nodes.find((n) => n.id === 'dim:genre:Ismeretlen')!.val).toBe(1)
  })
})

describe('buildGenreDetail', () => {
  const rows = [
    mk({ id: 1, anilistId: 100, genres: ['Action', 'Drama'], relations: [{ type: 'SEQUEL', anilistId: 200 }] }),
    mk({ id: 2, anilistId: 200, titleRomaji: 'B', genres: ['Action'] }),
    mk({ id: 3, anilistId: 300, titleRomaji: 'C', genres: ['Comedy'] }),
  ]

  it('includes only anime tagged with the genre, linked to a hub', () => {
    const g = buildGenreDetail(rows, 'Action')
    const ids = g.nodes.map((n) => n.id).sort()
    expect(ids).toEqual(['anime:1', 'anime:2', 'dim:genre:Action'].sort())
    expect(g.links).toContainEqual({ source: 'dim:genre:Action', target: 'anime:1', kind: 'chain' })
    expect(g.links).toContainEqual({ source: 'dim:genre:Action', target: 'anime:2', kind: 'chain' })
  })

  it('keeps relation edges within the subset', () => {
    const g = buildGenreDetail(rows, 'Action')
    expect(g.links).toContainEqual({ source: 'anime:1', target: 'anime:2', kind: 'relation' })
  })

  it('multi-genre anime shows up in each of its genres', () => {
    expect(buildGenreDetail(rows, 'Drama').nodes.some((n) => n.id === 'anime:1')).toBe(true)
  })
})
