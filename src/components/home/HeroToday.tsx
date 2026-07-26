'use client'
import Link from 'next/link'
import Image from 'next/image'
import Countdown from '@/components/Countdown'
import PosterAmbient from '@/components/ui/PosterAmbient'
import ScoreBadge from '@/components/ui/ScoreBadge'
import Button from '@/components/ui/Button'
import { pickHero } from '@/lib/home-hero'
import { STATUS_LABELS } from '@/lib/status'
import type { MineItem, SeasonItem } from './types'

type Props = {
  /** null = meg tolt; ilyenkor vazlat all a helyen, nincs layout-ugras */
  mine: MineItem[] | null
  season: SeasonItem[]
  fit: Record<number, number>
  digest: string | null
  onBump: (m: MineItem) => void
  onPlan: (anilistId: number) => void
  planned: Set<number>
}

export default function HeroToday({ mine, season, fit, digest, onBump, onPlan, planned }: Props) {
  if (mine == null) {
    return (
      <section className="surface-1 relative overflow-hidden rounded-[var(--r-xl)] px-6 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="h-2.5 w-16 rounded bg-white/8" />
          <div className="h-12 w-3/4 rounded bg-white/8" />
          <div className="h-3 w-1/2 rounded bg-white/8" />
        </div>
      </section>
    )
  }

  const pick = pickHero(mine, season, Math.floor(Date.now() / 1000), fit)
  if (pick.kind === 'empty') return null

  // az 'empty' agat mar visszaadtuk, a maradek harom varianson van .item
  const cover = pick.item.coverUrl
  const title = pick.item.title

  const eyebrow =
    pick.kind === 'airing' ? 'Ma' : pick.kind === 'watching' ? 'Ott folytatod' : 'Neked ajánljuk'

  const href =
    pick.kind === 'discover'
      ? `/anime/preview/${pick.item.anilistId}`
      : `/anime/${pick.item.animeId}`

  return (
    <section className="relative overflow-hidden rounded-[var(--r-xl)] hairline">
      <PosterAmbient src={cover} intensity="hero" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/92 via-[#09090b]/70 to-transparent pointer-events-none" />

      <div className="relative flex items-center gap-6 px-6 py-10 sm:px-10 sm:py-14">
        {cover && (
          <Link href={href} className="hidden sm:block shrink-0">
            <div className="relative w-32 lg:w-40 aspect-[2/3] overflow-hidden rounded-[var(--r-md)] shadow-2xl shadow-black/60">
              <Image src={cover} alt={title} fill sizes="160px" className="object-cover" />
            </div>
          </Link>
        )}

        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <p className="label-mono">{eyebrow}</p>
          <Link href={href}>
            <h1 className="display-xl text-text-1 line-clamp-2 hover:underline decoration-white/20 underline-offset-[10px]">
              {title}
            </h1>
          </Link>

          <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-text-2">
            {pick.kind === 'airing' && (
              <span className="text-text-1">
                EP {pick.item.nextEpisode} · <Countdown airingAt={pick.item.airingAt} />
              </span>
            )}
            {pick.kind === 'watching' && (
              <span className="text-text-1">
                {STATUS_LABELS[pick.item.status] ?? pick.item.status} ·{' '}
                {pick.item.progress}{pick.item.episodes ? `/${pick.item.episodes}` : ''}
              </span>
            )}
            {pick.kind === 'discover' && pick.score != null && (
              <ScoreBadge score={pick.score} kind="taste" title="Ennyire illik az ízlésedhez" />
            )}

            {pick.kind !== 'discover' ? (
              <Button size="md" onClick={() => onBump(pick.item)} title="Megnéztem egy részt">
                +1 rész
              </Button>
            ) : (
              <Button
                size="md"
                onClick={() => onPlan(pick.item.anilistId)}
                disabled={planned.has(pick.item.anilistId)}
              >
                {planned.has(pick.item.anilistId) ? '✓ Terveim között' : '+ Tervezem'}
              </Button>
            )}
          </div>

          {digest && (
            <p className="text-sm text-text-2 leading-relaxed max-w-[58ch] border-l border-white/12 pl-4 mt-1">
              <span className="label-mono mr-2">✦ ma</span>
              {digest}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
