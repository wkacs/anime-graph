import { describe, expect, it } from 'vitest'
import { monthlyEvolution, parseEras } from './evolution'

describe('monthlyEvolution', () => {
  it('havi darabszám + átlagpont, watchedAt előnyben', () => {
    const pts = monthlyEvolution([
      { watchedAt: '2026-01-15T00:00:00Z', createdAt: '2025-12-01T00:00:00Z', myScore: 8 },
      { watchedAt: null, createdAt: '2026-01-20T00:00:00Z', myScore: 6 },
      { watchedAt: '2026-03-05T00:00:00Z', createdAt: '2026-03-01T00:00:00Z', myScore: null },
    ])
    expect(pts).toEqual([
      { month: '2026-01', count: 2, avgScore: 7 },
      { month: '2026-03', count: 1, avgScore: null },
    ])
  })
})

describe('parseEras', () => {
  it('parseol', () => {
    const raw = '{"eras":[{"label":"Mecha-korszak","summary":"Ekkor minden a mecha volt, nagy robotok és dráma.","from":"2025-01","to":"2025-06"},{"label":"Slice-of-life","summary":"Lenyugodott az ízlésed, csendes történetek jöttek.","from":"2025-07","to":"2026-01"}]}'
    expect(parseEras(raw)).toHaveLength(2)
  })
})
