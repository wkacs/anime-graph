'use client'
import { useState } from 'react'
import Link from 'next/link'
import MediaCard from '@/components/MediaCard'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import ScoreBadge from '@/components/ui/ScoreBadge'
import { SEASON_LABELS, nextSeason } from '@/lib/seasonal'
import type { NextSeasonRow, UpcomingItem } from './types'

type Props = {
  /** AI-pontozott, szemelyre szabott valogatas */
  upcoming: UpcomingItem[]
  upcomingSeason: { season: string; year: number } | null
  /** a teljes bejelentett kinalat a lokalis katalogusbol */
  all: NextSeasonRow[] | null
  allFit: Record<number, number>
  onPlan: (anilistId: number) => void
  planned: Set<number>
}

// Korabban KET kulon szekcio volt ('neked' + 'teljes kinalat'). Egy szekcio
// togglelel: ugyanaz az informacio, fele annyi vizualis suly.
export default function NextSeason({ upcoming, upcomingSeason, all, allFit, onPlan, planned }: Props) {
  const [mode, setMode] = useState<'mine' | 'all'>(upcoming.length > 0 ? 'mine' : 'all')
  const ns = upcomingSeason ?? nextSeason(new Date())
  if (upcoming.length === 0 && (all == null || all.length === 0)) return null

  const grid = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8'

  return (
    <section>
      <SectionHeader
        eyebrow="Következő szezon"
        title={`${ns.year} ${SEASON_LABELS[ns.season] ?? ns.season}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-full hairline overflow-hidden">
              {([['mine', 'Neked'], ['all', 'Mind']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setMode(k)}
                  disabled={k === 'mine' ? upcoming.length === 0 : all == null || all.length === 0}
                  className={`px-3 py-1.5 text-xs transition-colors disabled:opacity-30 ${
                    mode === k ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Link
              href="/bongeszo?season=next"
              className="text-xs text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
            >
              Böngészőben →
            </Link>
          </div>
        }
      />

      {mode === 'mine' ? (
        <div className={grid}>
          {upcoming.map((s) => (
            <MediaCard
              key={s.anilistId}
              title={s.title}
              coverUrl={s.coverUrl}
              genres={s.genres}
              description={s.tasteReason}
              streaming={s.streaming}
              badge={<ScoreBadge score={s.tasteScore} kind="taste" title={s.tasteReason} />}
              footer={s.owned ? (
                <span className="label-mono text-[color:var(--status-watching)]">listádon</span>
              ) : (
                <Button onClick={() => onPlan(s.anilistId)} disabled={planned.has(s.anilistId)}>
                  {planned.has(s.anilistId) ? '✓' : '+ Tervezem'}
                </Button>
              )}
            />
          ))}
        </div>
      ) : (
        <div className={grid}>
          {(all ?? []).map((t) => (
            <MediaCard
              key={t.id}
              title={t.titleRomaji}
              coverUrl={t.coverUrl}
              genres={t.genres}
              href={`/${t.mediaType === 'MANGA' ? 'manga' : 'anime'}/${t.slug}`}
              badge={allFit[t.anilistId] != null ? (
                <ScoreBadge score={allFit[t.anilistId]} suffix="%" title="Ennyire illik az ízlésedhez" />
              ) : undefined}
              footer={t.format ? <span className="label-mono">{t.format}</span> : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}
