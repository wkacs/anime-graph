'use client'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import MediaCard from '@/components/MediaCard'
import Countdown from '@/components/Countdown'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import ScoreBadge from '@/components/ui/ScoreBadge'
import EmptyState from '@/components/ui/EmptyState'
import { reveal } from '@/lib/motion'
import SeasonFilterBar from '@/components/SeasonFilterBar'
import { useSeasonLabel } from '@/components/useLabels'
import { EMPTY_SEASON_VIEW, type SeasonView } from '@/lib/season-filter'
import type { SeasonItem } from './types'

// a seasonFacets() visszateresi tipusa (src/lib/season-filter.ts:49-53)
type Facets = { genres: string[]; formats: string[]; sites: string[] }

type Props = {
  season: { season: string; year: number }
  items: SeasonItem[]
  visible: SeasonItem[]
  fit: Record<number, number>
  view: SeasonView
  onView: (v: SeasonView) => void
  facets: Facets
  scored: boolean
  scoresFailed: boolean
  onPlan: (anilistId: number) => void
  planned: Set<number>
}

export default function SeasonGrid({
  season, items, visible, fit, view, onView, facets, scored, scoresFailed, onPlan, planned,
}: Props) {
  const t = useTranslations('home')
  const seasonLabel = useSeasonLabel()
  return (
    <section>
      <SectionHeader
        eyebrow={t('seasonEyebrow')}
        title={`${season.year} ${seasonLabel(season.season)}`}
      />
      <div className="mb-5">
        <SeasonFilterBar
          view={view}
          onChange={onView}
          facets={facets}
          shown={visible.length}
          total={items.length}
          scored={scored}
          scoresFailed={scoresFailed}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          eyebrow={t('filterEyebrow')}
          title={t('noMatch')}
          text={t('noMatchText')}
          action={
            <Button onClick={() => onView({ ...EMPTY_SEASON_VIEW, sort: view.sort })}>
              {t('relaxFilters')}
            </Button>
          }
        />
      ) : (
        <div
          data-tour="season"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8"
        >
          {visible.map((s, i) => (
            <motion.article key={s.anilistId} {...reveal(i)} className="h-full">
              <MediaCard
                title={s.title}
                coverUrl={s.coverUrl}
                genres={s.genres}
                description={s.description}
                streaming={s.streaming}
                badge={s.tasteScore != null ? (
                  <ScoreBadge score={s.tasteScore} kind="taste" title={s.tasteReason ?? undefined} />
                ) : fit[s.anilistId] != null ? (
                  <ScoreBadge score={fit[s.anilistId]} suffix="%" title={t('fitTooltipLocal')} />
                ) : undefined}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[12px] text-text-1">
                      {s.airingAt != null ? (
                        <>EP {s.nextEpisode} · <Countdown airingAt={s.airingAt} /></>
                      ) : (
                        <span className="text-text-3">{t('notAiring')}</span>
                      )}
                    </p>
                    {s.owned ? (
                      <span className="label-mono text-[color:var(--status-watching)]">{t('onYourList')}</span>
                    ) : (
                      <Button onClick={() => onPlan(s.anilistId)} disabled={planned.has(s.anilistId)}>
                        {planned.has(s.anilistId) ? '✓' : t('planIt')}
                      </Button>
                    )}
                  </div>
                }
              />
            </motion.article>
          ))}
        </div>
      )}
    </section>
  )
}
