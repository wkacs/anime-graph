export type HeatCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

// GitHub-style activity grid: `weeks` columns × 7 rows, ending on `end`
export function buildHeatmapCells(
  entries: { date: string; count: number }[],
  end: Date,
  weeks = 26,
): HeatCell[] {
  const byDate = new Map(entries.map((e) => [e.date, e.count]))
  const max = Math.max(...entries.map((e) => e.count), 1)
  const days = weeks * 7
  const cells: HeatCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400_000)
    const date = dayKey(d)
    const count = byDate.get(date) ?? 0
    const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as HeatCell['level']
    cells.push({ date, count, level })
  }
  return cells
}
