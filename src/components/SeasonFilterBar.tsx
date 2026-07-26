'use client'
import {
  FORMAT_LABELS,
  MIN_SCORE_STEPS,
  SORT_LABELS,
  type SeasonSort,
  type SeasonView,
} from '@/lib/season-filter'

type Facets = { genres: string[]; formats: string[]; sites: string[] }

type Props = {
  view: SeasonView
  onChange: (v: SeasonView) => void
  facets: Facets
  shown: number
  total: number
  scored: boolean
  scoresFailed: boolean
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-xs whitespace-nowrap border transition-colors ${
        active
          ? 'border-transparent bg-white/15 text-text-1'
          : 'border-white/10 text-text-3 hover:text-text-1 hover:border-white/20'
      }`}
    >
      {children}
    </button>
  )
}

export default function SeasonFilterBar({ view, onChange, facets, shown, total, scored, scoresFailed }: Props) {
  const sorts: SeasonSort[] = ['taste', 'airing', 'score', 'popularity']
  const filtersActive =
    view.genres.length > 0 || view.formats.length > 0 || view.sites.length > 0 || view.minScore > 0

  return (
    <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* flex-wrap: negy rendezes-chip 390px-en 420px-et adott -> vizszintes
            lap-tulcsordulas. A tobbi sav mar tordelt, ez kimaradt. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-mono">Rendezés</span>
          {sorts.map((s) => (
            <Chip
              key={s}
              active={view.sort === s}
              onClick={() => onChange({ ...view, sort: s })}
            >
              {SORT_LABELS[s]}
              {s === 'taste' && !scored && ' ·'}
            </Chip>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="label-mono tabular-nums">
            {shown} / {total}
          </span>
          {filtersActive && (
            <button
              onClick={() => onChange({ ...view, genres: [], formats: [], sites: [], minScore: 0 })}
              className="btn-ghost px-2 py-0.5 text-xs text-text-3"
            >
              szűrők törlése
            </button>
          )}
        </div>
      </div>

      {facets.genres.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-mono mr-1">Műfaj</span>
          {facets.genres.map((g) => (
            <Chip key={g} active={view.genres.includes(g)} onClick={() => onChange({ ...view, genres: toggle(view.genres, g) })}>
              {g}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {facets.formats.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-mono mr-1">Formátum</span>
            {facets.formats.map((f) => (
              <Chip key={f} active={view.formats.includes(f)} onClick={() => onChange({ ...view, formats: toggle(view.formats, f) })}>
                {FORMAT_LABELS[f] ?? f}
              </Chip>
            ))}
          </div>
        )}

        {facets.sites.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-mono mr-1">Streaming</span>
            {facets.sites.map((s) => (
              <Chip key={s} active={view.sites.includes(s)} onClick={() => onChange({ ...view, sites: toggle(view.sites, s) })}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        {/* pont nélkül minden küszöb üres rácsot adna — ilyenkor a sáv el is tűnik */}
        {scored && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-mono mr-1">Min. pont</span>
            {MIN_SCORE_STEPS.map((m) => (
              <Chip key={m} active={view.minScore === m} onClick={() => onChange({ ...view, minScore: m })}>
                {m === 0 ? 'mind' : `${m}+`}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {!scored && (
        <p className="label-mono">
          {scoresFailed ? 'AI-pont most nem elérhető — adásidő szerint rendezve' : 'Ízlés-pontok számolása…'}
        </p>
      )}
    </div>
  )
}
