'use client'

// Közös, monokróm chart-primitívek: a saját Stats oldal és a publikus
// /u/[username] profil ugyanazt a megjelenítést kapja. Csak propokból
// dolgoznak, nincs fetch — a hívó dönt az adat forrásáról.

// single-series monochrome radar: axes = top genres, value = count
export function GenreRadar({ data, ariaLabel }: { data: { name: string; count: number }[]; ariaLabel: string }) {
  const cx = 130, cy = 118, r = 82
  const max = Math.max(...data.map((d) => d.count), 1)
  const angle = (i: number) => (Math.PI * 2 * i) / data.length - Math.PI / 2
  const point = (i: number, ratio: number) =>
    `${cx + Math.cos(angle(i)) * r * ratio},${cy + Math.sin(angle(i)) * r * ratio}`
  const ring = (ratio: number) => data.map((_, i) => point(i, ratio)).join(' ')
  const values = data.map((d, i) => point(i, d.count / max)).join(' ')

  return (
    // a -30..290 vízszintes tartomány a hosszú tengely-címkéknek (pl.
    // "Psychological · 70") ad helyet — 260-nál a szélső feliratok levágódtak
    <svg viewBox="-30 0 320 236" className="w-full" role="img" aria-label={ariaLabel}>
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
        const cos = Math.cos(angle(i))
        // a vízszintes szélső tengelyeken (bal/jobb csúcs) az oldalra írt címke
        // kilógna a kártyából → ott a csúcs FÖLÉ kerül, középre igazítva
        const horizontal = Math.abs(cos) > 0.85
        const lx = cx + cos * (r + (horizontal ? 6 : 16))
        const ly = cy + Math.sin(angle(i)) * (r + 16) - (horizontal ? 14 : 0)
        const anchor = horizontal || Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end'
        // a nagyon hosszú műfajnév ("Psychological") így is rövidül; a teljes
        // név a <title> tooltipben marad
        const label = d.name.length > 13 ? `${d.name.slice(0, 11)}…` : d.name
        return (
          <text key={d.name} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize="10" fill="var(--text-2)">
            <title>{d.name}: {d.count}</title>
            {label} · {d.count}
          </text>
        )
      })}
    </svg>
  )
}

// monochrome column chart with per-bar hover value
export function Bars({ data, ariaLabel }: { data: { label: string; count: number }[]; ariaLabel: string }) {
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
