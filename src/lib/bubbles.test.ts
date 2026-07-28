import { describe, it, expect } from 'vitest'
import { buildBubbles, buildGenreDetail, type GraphAnime } from './graph-builder'

const mk = (over: Partial<GraphAnime>): GraphAnime => ({
  id: 1, anilistId: 100, titleRomaji: 'A', coverUrl: null,
  genres: ['Action'], studio: 'MAPPA', year: 2020, status: 'completed',
  myScore: 8, relations: [], ...over,
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

  it('anime without genre lands in the unknown bubble', () => {
    const g = buildBubbles([mk({ genres: [] })])
    expect(g.nodes.find((n) => n.id === 'dim:genre:Unknown')!.val).toBe(1)
  })

  it('collects up to 3 top-scored covers per bubble', () => {
    const rows = [
      mk({ id: 1, coverUrl: 'c1', myScore: 6 }),
      mk({ id: 2, anilistId: 200, coverUrl: 'c2', myScore: 10 }),
      mk({ id: 3, anilistId: 300, coverUrl: 'c3', myScore: 8 }),
      mk({ id: 4, anilistId: 400, coverUrl: 'c4', myScore: 9 }),
      mk({ id: 5, anilistId: 500, coverUrl: null, myScore: 10 }),
    ]
    const g = buildBubbles(rows)
    expect(g.nodes.find((n) => n.id === 'dim:genre:Action')!.covers).toEqual(['c2', 'c4', 'c3'])
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

  it('adds vibe edges between anime sharing enough tags, capped per anime', () => {
    const tags = (names: string[]) => names.map((name) => ({ name, rank: 50 }))
    const rowsWithTags = [
      mk({ id: 1, anilistId: 100, tags: tags(['Time Travel', 'Thriller', 'Scientist', 'Romance']) }),
      mk({ id: 2, anilistId: 200, titleRomaji: 'B', tags: tags(['Time Travel', 'Thriller', 'Scientist']) }),
      mk({ id: 3, anilistId: 300, titleRomaji: 'C', tags: tags(['Mecha', 'Space']) }),
    ]
    const g = buildGenreDetail(rowsWithTags, 'Action')
    const vibe = g.links.filter((l) => l.kind === 'vibe')
    expect(vibe).toEqual([{ source: 'anime:1', target: 'anime:2', kind: 'vibe' }])
  })
})
