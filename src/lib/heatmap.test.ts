import { describe, it, expect } from 'vitest'
import { buildHeatmapCells } from './heatmap'

describe('buildHeatmapCells', () => {
  it('builds a weeks x 7 grid ending today with levels', () => {
    const end = new Date('2026-07-18T12:00:00Z') // szombat
    const cells = buildHeatmapCells(
      [
        { date: '2026-07-18', count: 4 },
        { date: '2026-07-15', count: 1 },
      ],
      end,
      2,
    )
    expect(cells).toHaveLength(14)
    const sat = cells.find((c) => c.date === '2026-07-18')!
    const wed = cells.find((c) => c.date === '2026-07-15')!
    expect(sat.level).toBe(4)
    expect(wed.level).toBeGreaterThanOrEqual(1)
    expect(wed.level).toBeLessThan(sat.level)
    expect(cells.filter((c) => c.count === 0).every((c) => c.level === 0)).toBe(true)
  })

  it('last cell is the end date', () => {
    const end = new Date('2026-07-18T12:00:00Z')
    const cells = buildHeatmapCells([], end, 4)
    expect(cells[cells.length - 1].date).toBe('2026-07-18')
  })
})
