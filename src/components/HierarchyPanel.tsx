'use client'
import { type Dimension, type GraphConfig, DIM_LABELS } from '@/lib/graph-builder'

const ALL_DIMS: Dimension[] = ['genre', 'studio', 'scoreBand', 'year', 'status']

export default function HierarchyPanel({
  config,
  onChange,
}: {
  config: GraphConfig
  onChange: (c: GraphConfig) => void
}) {
  const inactive = ALL_DIMS.filter((d) => !config.levels.includes(d))

  function move(i: number, dir: -1 | 1) {
    const levels = [...config.levels]
    const j = i + dir
    if (j < 0 || j >= levels.length) return
    ;[levels[i], levels[j]] = [levels[j], levels[i]]
    onChange({ ...config, levels })
  }

  return (
    <div className="w-60 rounded-xl bg-slate-900/85 border border-slate-700 p-4 text-sm text-slate-200 backdrop-blur">
      <h2 className="font-semibold mb-2">Hierarchia-szintek</h2>
      <ul className="flex flex-col gap-1 mb-3">
        {config.levels.map((d, i) => (
          <li key={d} className="flex items-center gap-2 rounded bg-slate-800 px-2 py-1">
            <span className="flex-1">{i + 1}. {DIM_LABELS[d]}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === config.levels.length - 1} className="disabled:opacity-30">▼</button>
            <button
              onClick={() => onChange({ ...config, levels: config.levels.filter((x) => x !== d) })}
              className="text-red-400"
              title="Szint kikapcsolása"
            >✕</button>
          </li>
        ))}
        {config.levels.length === 0 && <li className="text-slate-500 italic">Nincs szint — csak animék</li>}
      </ul>
      {inactive.length > 0 && (
        <div className="mb-3">
          <p className="text-slate-400 mb-1">Hozzáadható:</p>
          <div className="flex flex-wrap gap-1">
            {inactive.map((d) => (
              <button
                key={d}
                onClick={() => onChange({ ...config, levels: [...config.levels, d] })}
                className="rounded-full border border-slate-600 px-2 py-0.5 hover:border-cyan-400"
              >+ {DIM_LABELS[d]}</button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 mb-1">
        <input
          type="checkbox"
          checked={config.crossLinks}
          onChange={(e) => onChange({ ...config, crossLinks: e.target.checked })}
        />
        Sequel/prequel élek
      </label>
      <label className="flex items-center gap-2">
        Méret:
        <select
          value={config.sizeBy}
          onChange={(e) => onChange({ ...config, sizeBy: e.target.value as GraphConfig['sizeBy'] })}
          className="bg-slate-800 rounded px-1 py-0.5"
        >
          <option value="score">Pontszám</option>
          <option value="elo">Elo</option>
        </select>
      </label>
    </div>
  )
}
