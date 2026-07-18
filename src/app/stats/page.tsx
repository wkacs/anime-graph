'use client'
import { useEffect, useMemo, useState } from 'react'
import WrappedCard from '@/components/WrappedCard'
import { buildHeatmapCells, type HeatCell } from '@/lib/heatmap'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime } from '@/lib/types'

const HEAT_ALPHA = [0.05, 0.22, 0.42, 0.65, 0.95]

const STATUS_ORDER = ['completed', 'watching', 'planned', 'dropped'] as const

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="glass rounded-3xl px-5 py-4">
      <p className="label-mono mb-1.5">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-text-3 ml-1.5">{unit}</span>}
      </p>
    </div>
  )
}

// single-series monochrome radar: axes = top genres, value = count
function GenreRadar({ data }: { data: { name: string; count: number }[] }) {
  const cx = 130, cy = 118, r = 82
  const max = Math.max(...data.map((d) => d.count), 1)
  const angle = (i: number) => (Math.PI * 2 * i) / data.length - Math.PI / 2
  const point = (i: number, ratio: number) =>
    `${cx + Math.cos(angle(i)) * r * ratio},${cy + Math.sin(angle(i)) * r * ratio}`
  const ring = (ratio: number) => data.map((_, i) => point(i, ratio)).join(' ')
  const values = data.map((d, i) => point(i, d.count / max)).join(' ')

  return (
    <svg viewBox="0 0 260 236" className="w-full" role="img" aria-label="Műfaj-radar">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon key={ratio} points={ring(ratio)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {data.map((_, i) => (
        <line
          key={i}
          x1={cx} y1={cy}
          x2={cx + Math.cos(angle(i)) * r} y2={cy + Math.sin(angle(i)) * r}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1"
        />
      ))}
      <polygon points={values} fill="rgba(250,250,250,0.12)" stroke="#fafafa" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const ratio = d.count / max
        return (
          <circle key={d.name} cx={cx + Math.cos(angle(i)) * r * ratio} cy={cy + Math.sin(angle(i)) * r * ratio} r="3" fill="#fafafa">
            <title>{d.name}: {d.count}</title>
          </circle>
        )
      })}
      {data.map((d, i) => {
        const lx = cx + Math.cos(angle(i)) * (r + 16)
        const ly = cy + Math.sin(angle(i)) * (r + 16)
        const anchor = Math.abs(Math.cos(angle(i))) < 0.3 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end'
        return (
          <text key={d.name} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize="10" fill="var(--text-2)">
            {d.name} · {d.count}
          </text>
        )
      })}
    </svg>
  )
}

// monochrome column chart with per-bar hover value
function Bars({ data, ariaLabel }: { data: { label: string; count: number }[]; ariaLabel: string }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div role="img" aria-label={ariaLabel} className="flex items-end gap-[2px] h-36">
      {data.map((d) => (
        <div key={d.label} className="group flex-1 flex flex-col items-center justify-end h-full min-w-0">
          <span className="font-mono text-[10px] text-text-1 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
            {d.count}
          </span>
          <div
            className="w-full rounded-t-[4px] bg-white/85 group-hover:bg-white transition-colors"
            style={{ height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)}%` }}
          >
            <span className="sr-only">{d.label}: {d.count}</span>
          </div>
          <span className="label-mono mt-1.5 truncate max-w-full">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function StatsPage() {
  const [list, setList] = useState<ApiAnime[]>([])
  const [loaded, setLoaded] = useState(false)
  const [heatCells, setHeatCells] = useState<HeatCell[]>([])

  useEffect(() => {
    fetch('/api/anime').then((r) => r.json()).then((j) => {
      setList(j.anime ?? [])
      setLoaded(true)
    })
    fetch('/api/heatmap').then((r) => r.json()).then((j) => {
      setHeatCells(buildHeatmapCells(j.entries ?? [], new Date(), 26))
    }).catch(() => { /* heatmap nélkül is él */ })
  }, [])

  const stats = useMemo(() => {
    const watchedMinutes = list.reduce((sum, a) => {
      const dur = a.durationMin ?? 24
      const eps = a.status === 'completed' ? (a.episodes ?? a.progress) : a.progress
      return sum + dur * (eps ?? 0)
    }, 0)
    const scored = list.filter((a) => a.myScore != null)
    const avgScore = scored.length
      ? scored.reduce((s, a) => s + (a.myScore ?? 0), 0) / scored.length
      : null

    const genreCounts = new Map<string, number>()
    for (const a of list) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
    const topGenres = [...genreCounts.entries()]
      .sort((x, y) => y[1] - x[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    const scoreDist = Array.from({ length: 10 }, (_, i) => ({
      label: String(i + 1),
      count: list.filter((a) => a.myScore === i + 1).length,
    }))

    const yearCounts = new Map<number, number>()
    for (const a of list) if (a.year != null) yearCounts.set(a.year, (yearCounts.get(a.year) ?? 0) + 1)
    const years = [...yearCounts.entries()].sort((x, y) => x[0] - y[0])
      .map(([y, count]) => ({ label: String(y), count }))

    const studioCounts = new Map<string, number>()
    for (const a of list) if (a.studio) studioCounts.set(a.studio, (studioCounts.get(a.studio) ?? 0) + 1)
    const topStudios = [...studioCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)

    const statusCounts = STATUS_ORDER.map((s) => ({
      status: s,
      count: list.filter((a) => a.status === s).length,
    }))

    return { watchedMinutes, avgScore, topGenres, scoreDist, years, topStudios, statusCounts }
  }, [list])

  if (!loaded) return null

  if (list.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-3xl px-10 py-12 text-center">
          <p className="label-mono mb-2">Stats</p>
          <p className="text-sm text-text-2">Még nincs adat — adj hozzá animéket a gráfon.</p>
        </div>
      </main>
    )
  }

  const maxStudio = Math.max(...stats.topStudios.map(([, c]) => c), 1)
  const completedCount = stats.statusCounts.find((s) => s.status === 'completed')?.count ?? 0

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Stats</h1>
        <WrappedCard list={list} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Anime a listán" value={String(list.length)} />
        <StatTile label="Nézett idő" value={(stats.watchedMinutes / 60).toFixed(0)} unit="óra" />
        <StatTile label="Befejezve" value={String(completedCount)} />
        <StatTile label="Átlagpontom" value={stats.avgScore != null ? stats.avgScore.toFixed(1) : '–'} unit={stats.avgScore != null ? '/ 10' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-2">Műfaj-radar</p>
          {stats.topGenres.length >= 3 ? (
            <GenreRadar data={stats.topGenres} />
          ) : (
            <ul className="flex flex-col gap-2 mt-2">
              {stats.topGenres.map((g) => (
                <li key={g.name} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-text-2">{g.name}</span>
                  <span className="font-mono text-xs">{g.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-3xl p-5 flex flex-col">
          <p className="label-mono mb-4">Pontszám-eloszlás</p>
          <div className="mt-auto">
            <Bars data={stats.scoreDist} ariaLabel="Pontszám-eloszlás 1-től 10-ig" />
          </div>
        </section>

        <section className="glass rounded-3xl p-5 flex flex-col">
          <p className="label-mono mb-4">Évek</p>
          <div className="mt-auto">
            <Bars data={stats.years} ariaLabel="Animék száma évenként" />
          </div>
        </section>

        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-4">Stúdió-toplista</p>
          <ul className="flex flex-col gap-2.5">
            {stats.topStudios.map(([name, count]) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate text-text-2">{name}</span>
                <span className="flex-1 h-2 rounded-full bg-white/6 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-white/80"
                    style={{ width: `${(count / maxStudio) * 100}%` }}
                  />
                </span>
                <span className="font-mono text-xs text-text-2 w-6 text-right">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {heatCells.some((c) => c.count > 0) && (
        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-4">Aktivitás — az elmúlt fél év</p>
          <div className="overflow-x-auto no-scrollbar">
            <div className="grid grid-rows-7 grid-flow-col gap-[3px] w-max">
              {heatCells.map((c) => (
                <span
                  key={c.date}
                  title={`${c.date} · ${c.count} rész`}
                  className="w-2.5 h-2.5 rounded-[3px]"
                  style={{ background: `rgba(250,250,250,${HEAT_ALPHA[c.level]})` }}
                />
              ))}
            </div>
          </div>
          <p className="label-mono mt-3">A „+1 rész” kattintásaidból épül</p>
        </section>
      )}

      <section className="glass rounded-3xl p-5">
        <p className="label-mono mb-4">Státusz-megoszlás</p>
        <div className="flex h-3 rounded-full overflow-hidden gap-[2px]">
          {stats.statusCounts.filter((s) => s.count > 0).map((s) => (
            <span
              key={s.status}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(s.count / list.length) * 100}%`,
                background: STATUS_CSS_VARS[s.status],
              }}
            >
              <span className="sr-only">{STATUS_LABELS[s.status]}: {s.count}</span>
            </span>
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
          {stats.statusCounts.map((s) => (
            <li key={s.status} className="flex items-center gap-2 text-sm text-text-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CSS_VARS[s.status] }} />
              {STATUS_LABELS[s.status]}
              <span className="font-mono text-xs text-text-3">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
