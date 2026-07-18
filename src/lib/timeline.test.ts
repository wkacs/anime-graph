import { describe, it, expect } from 'vitest'
import { buildTimeline, type TimelineAnime } from './graph-builder'

const mk = (over: Partial<TimelineAnime>): TimelineAnime => ({
  id: 1, anilistId: 100, titleRomaji: 'A', coverUrl: null,
  genres: ['Action'], studio: 'MAPPA', year: 2020, status: 'completed',
  myScore: 8, elo: 1200, relations: [],
  watchedAt: '2024-03-10T00:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z',
  ...over,
})

describe('buildTimeline', () => {
  it('orders anime along x by watch date and pins coordinates', () => {
    const rows = [
      mk({ id: 1, watchedAt: '2024-06-01T00:00:00.000Z' }),
      mk({ id: 2, anilistId: 200, titleRomaji: 'B', watchedAt: '2023-01-01T00:00:00.000Z' }),
    ]
    const g = buildTimeline(rows)
    const a1 = g.nodes.find((n) => n.id === 'anime:1')!
    const a2 = g.nodes.find((n) => n.id === 'anime:2')!
    expect(a2.fx).toBeLessThan(a1.fx!)
    for (const n of [a1, a2]) {
      expect(typeof n.fx).toBe('number')
      expect(typeof n.fy).toBe('number')
      expect(typeof n.fz).toBe('number')
    }
  })

  it('falls back to createdAt when watchedAt is null', () => {
    const rows = [
      mk({ id: 1, watchedAt: null, createdAt: '2022-01-01T00:00:00.000Z' }),
      mk({ id: 2, anilistId: 200, watchedAt: '2023-01-01T00:00:00.000Z' }),
    ]
    const g = buildTimeline(rows)
    expect(g.nodes.find((n) => n.id === 'anime:1')!.fx)
      .toBeLessThan(g.nodes.find((n) => n.id === 'anime:2')!.fx!)
  })

  it('adds a year marker node at each year change', () => {
    const rows = [
      mk({ id: 1, watchedAt: '2023-05-01T00:00:00.000Z' }),
      mk({ id: 2, anilistId: 200, watchedAt: '2023-08-01T00:00:00.000Z' }),
      mk({ id: 3, anilistId: 300, watchedAt: '2024-02-01T00:00:00.000Z' }),
    ]
    const g = buildTimeline(rows)
    const markers = g.nodes.filter((n) => n.timeNode)
    expect(markers.map((m) => m.label)).toEqual(['2023', '2024'])
    expect(markers.every((m) => typeof m.fx === 'number')).toBe(true)
  })

  it('keeps only relation links between owned anime', () => {
    const rows = [
      mk({ id: 1, anilistId: 100, relations: [{ type: 'SEQUEL', anilistId: 200 }] }),
      mk({ id: 2, anilistId: 200, watchedAt: '2025-01-01T00:00:00.000Z' }),
    ]
    const g = buildTimeline(rows)
    expect(g.links).toEqual([{ source: 'anime:1', target: 'anime:2', kind: 'relation' }])
  })

  it('jitter is deterministic per id', () => {
    const a = buildTimeline([mk({ id: 7 })]).nodes[0]
    const b = buildTimeline([mk({ id: 7 })]).nodes[0]
    expect(a.fy).toBe(b.fy)
    expect(a.fz).toBe(b.fz)
  })
})
