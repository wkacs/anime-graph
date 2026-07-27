'use client'
import { useId, useState } from 'react'
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
      className={`rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
        active
          ? 'border-transparent bg-white/15 text-text-1'
          : 'border-white/10 text-text-2 hover:border-white/25 hover:text-text-1'
      }`}
    >
      {children}
    </button>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-mono mr-1 w-full sm:w-auto">{label}</span>
      {children}
    </div>
  )
}

export default function SeasonFilterBar({ view, onChange, facets, shown, total, scored, scoresFailed }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const sorts: SeasonSort[] = ['taste', 'airing', 'score', 'popularity']
  const activeCount =
    view.genres.length + view.formats.length + view.sites.length + (view.minScore > 0 ? 1 : 0)
  const filtersActive = activeCount > 0

  return (
    <div className="glass rounded-2xl">
      {/* Összecsukva egyetlen vékony sor. Korábban a teljes szűrő-panel
          (rendezés + műfaj + formátum + streaming + min. pont) mindig nyitva
          állt, és elvitte a képernyő tetejét a tartalom elől. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className="label-mono shrink-0">Rendezés</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-text-1">
          {SORT_LABELS[view.sort]}
          {filtersActive && <span className="text-text-2">{` · ${activeCount} szűrő`}</span>}
        </span>
        <span className="shrink-0 font-mono text-[13px] tabular-nums text-text-2">
          {shown}/{total}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-text-2 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {/* Nyitás CSS grid-template-rows 0fr -> 1fr-rel, NEM framer-motion
          height:'auto'-tal. Az mérés-alapú, és itt megbicsaklott: nyitáskor
          0-ról a végleges magasságra ugrott animáció nélkül, záráskor pedig
          félmagasságban beragadt. A grid-trükk nem mér semmit.
          A reduced-motion a globals.css globális szabályából jön. */}
      {/* A grid-template-rows INLINE megy, nem Tailwind osztállyal: a
          `grid-rows-[1fr]`-t a Tailwind `minmax(0, 1fr)`-ré fordítja, ami
          határozatlan magasságú konténerben 0px-re oldódik fel — a panel
          némán nem nyílt ki. Mérve: a class váltott, a computed 0px maradt. */}
      <div
        id={panelId}
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* inert: csukott állapotban a chipek ne legyenek tabbal elérhetők */}
        <div className="overflow-hidden" inert={!open}>
          <div className="flex flex-col gap-3.5 border-t border-white/8 px-4 py-3.5">
              <Group label="Rendezés">
                {sorts.map((s) => (
                  <Chip key={s} active={view.sort === s} onClick={() => onChange({ ...view, sort: s })}>
                    {SORT_LABELS[s]}
                    {s === 'taste' && !scored && ' ·'}
                  </Chip>
                ))}
              </Group>

              {facets.genres.length > 0 && (
                <Group label="Műfaj">
                  {facets.genres.map((g) => (
                    <Chip key={g} active={view.genres.includes(g)} onClick={() => onChange({ ...view, genres: toggle(view.genres, g) })}>
                      {g}
                    </Chip>
                  ))}
                </Group>
              )}

              {facets.formats.length > 1 && (
                <Group label="Formátum">
                  {facets.formats.map((f) => (
                    <Chip key={f} active={view.formats.includes(f)} onClick={() => onChange({ ...view, formats: toggle(view.formats, f) })}>
                      {FORMAT_LABELS[f] ?? f}
                    </Chip>
                  ))}
                </Group>
              )}

              {facets.sites.length > 0 && (
                <Group label="Streaming">
                  {facets.sites.map((s) => (
                    <Chip key={s} active={view.sites.includes(s)} onClick={() => onChange({ ...view, sites: toggle(view.sites, s) })}>
                      {s}
                    </Chip>
                  ))}
                </Group>
              )}

              {/* pont nélkül minden küszöb üres rácsot adna — ilyenkor a sáv el is tűnik */}
              {scored && (
                <Group label="Min. pont">
                  {MIN_SCORE_STEPS.map((m) => (
                    <Chip key={m} active={view.minScore === m} onClick={() => onChange({ ...view, minScore: m })}>
                      {m === 0 ? 'mind' : `${m}+`}
                    </Chip>
                  ))}
                </Group>
              )}

              {filtersActive && (
                <div>
                  <button
                    onClick={() => onChange({ ...view, genres: [], formats: [], sites: [], minScore: 0 })}
                    className="btn-ghost border border-white/12 px-3 py-1.5 text-[13px] text-text-2"
                  >
                    Szűrők törlése
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>

      {!scored && (
        <p className="label-mono border-t border-white/8 px-4 py-2">
          {scoresFailed ? 'AI-pont most nem elérhető, adásidő szerint rendezve' : 'Ízlés-pontok számolása…'}
        </p>
      )}
    </div>
  )
}
