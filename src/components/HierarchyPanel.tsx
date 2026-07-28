'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { type GraphConfig, ALL_DIMENSIONS } from '@/lib/graph-builder'

export default function HierarchyPanel({
  config,
  onChange,
}: {
  config: GraphConfig
  onChange: (c: GraphConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('hierarchy')
  const td = useTranslations('dimension')
  const inactive = ALL_DIMENSIONS.filter((d) => !config.levels.includes(d))

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
        className="surface-overlay shrink-0 rounded-full px-4 py-2.5 text-xs text-text-2 hover:text-text-1 transition-colors"
      >
        {t('levels')} · {config.levels.length}
      </button>
    )
  }

  return (
    <div className="surface-overlay rounded-2xl w-64 p-4 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="label-mono">{t('title')}</span>
        <button onClick={() => setOpen(false)} className="btn-ghost px-2 py-0.5 text-xs">✕</button>
      </div>
      <ul className="flex flex-col gap-1 mb-3">
        {config.levels.map((d, i) => (
          <li key={d} className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2.5 py-1.5">
            <span className="flex-1 text-text-1">{i + 1} · {td(d)}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost px-1 disabled:opacity-25">▲</button>
            <button onClick={() => move(i, 1)} disabled={i === config.levels.length - 1} className="btn-ghost px-1 disabled:opacity-25">▼</button>
            <button
              onClick={() => onChange({ ...config, levels: config.levels.filter((x) => x !== d) })}
              className="btn-ghost px-1 text-text-3 hover:text-[color:var(--status-dropped)]"
              title={t('removeLevel')}
            >✕</button>
          </li>
        ))}
        {config.levels.length === 0 && (
          <li className="text-text-3 italic px-1">{t('noLevels')}</li>
        )}
      </ul>
      {inactive.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {inactive.map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...config, levels: [...config.levels, d] })}
              className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-text-2 hover:text-text-1 hover:border-white/30 transition-colors"
            >+ {td(d)}</button>
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
        {t('sequelLinks')}
      </label>
      <label className="flex items-center gap-2 text-text-2" title={t('viewTooltip')}>
        {t('view')}
        <select
          value={config.covers ?? 'auto'}
          onChange={(e) => onChange({ ...config, covers: e.target.value as GraphConfig['covers'] })}
          className="field px-2 py-1 text-xs"
        >
          <option value="auto">{t('viewAuto')}</option>
          <option value="on">{t('viewFull')}</option>
          <option value="off">{t('viewDots')}</option>
        </select>
      </label>
    </div>
  )
}
