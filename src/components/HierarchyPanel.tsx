'use client'
import { useState } from 'react'
import { type Dimension, type GraphConfig, DIM_LABELS } from '@/lib/graph-builder'

const ALL_DIMS: Dimension[] = ['genre', 'studio', 'scoreBand', 'year', 'status']

export default function HierarchyPanel({
  config,
  onChange,
}: {
  config: GraphConfig
  onChange: (c: GraphConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const inactive = ALL_DIMS.filter((d) => !config.levels.includes(d))

  function move(i: number, dir: -1 | 1) {
    const levels = [...config.levels]
    const j = i + dir
    if (j < 0 || j >= levels.length) return
    ;[levels[i], levels[j]] = [levels[j], levels[i]]
    onChange({ ...config, levels })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass rounded-full px-4 py-2.5 label-mono hover:bg-white/10 transition-colors"
      >
        Szintek · {config.levels.length}
      </button>
    )
  }

  return (
    <div className="glass rounded-2xl w-64 p-4 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="label-mono">Hierarchia</span>
        <button onClick={() => setOpen(false)} className="btn-ghost px-2 py-0.5 text-xs">✕</button>
      </div>
      <ul className="flex flex-col gap-1 mb-3">
        {config.levels.map((d, i) => (
          <li key={d} className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2.5 py-1.5">
            <span className="flex-1 text-text-1">{i + 1} · {DIM_LABELS[d]}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost px-1 disabled:opacity-25">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === config.levels.length - 1} className="btn-ghost px-1 disabled:opacity-25">▼</button>
            <button
              onClick={() => onChange({ ...config, levels: config.levels.filter((x) => x !== d) })}
              className="btn-ghost px-1 text-text-3 hover:text-[color:var(--status-dropped)]"
              title="Szint kikapcsolása"
            >✕</button>
          </li>
        ))}
        {config.levels.length === 0 && (
          <li className="text-text-3 italic px-1">Nincs szint — csak animék</li>
        )}
      </ul>
      {inactive.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {inactive.map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...config, levels: [...config.levels, d] })}
              className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-text-2 hover:text-text-1 hover:border-white/30 transition-colors"
            >+ {DIM_LABELS[d]}</button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 mb-2 text-text-2">
        <input
          type="checkbox"
          checked={config.crossLinks}
          onChange={(e) => onChange({ ...config, crossLinks: e.target.checked })}
          className="accent-white"
        />
        Sequel/prequel élek
      </label>
      <label className="flex items-center gap-2 text-text-2" title="Auto: sok animénél kisebb borító, név nélkül (a név hoverre így is látszik). Teljes: mindig nagy borító + név. Csak pöttyök: leggyorsabb.">
        Nézet:
        <select
          value={config.covers ?? 'auto'}
          onChange={(e) => onChange({ ...config, covers: e.target.value as GraphConfig['covers'] })}
          className="field px-2 py-1 text-xs"
        >
          <option value="auto">Auto</option>
          <option value="on">Teljes</option>
          <option value="off">Csak pöttyök</option>
        </select>
      </label>
    </div>
  )
}
