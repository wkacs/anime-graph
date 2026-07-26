'use client'
import { motion } from 'framer-motion'
import MediaCard from '@/components/MediaCard'
import Countdown from '@/components/Countdown'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import { reveal } from '@/lib/motion'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { MineItem } from './types'

type Props = {
  mine: MineItem[]
  /** a hero-ban mar szereplo cim nem ismetlodik itt */
  excludeAnimeId?: number
  onBump: (m: MineItem) => void
}

export default function FollowedRow({ mine, excludeAnimeId, onBump }: Props) {
  const items = mine.filter((m) => m.animeId !== excludeAnimeId)
  if (items.length === 0) return null

  return (
    <section>
      <SectionHeader eyebrow="Amit követsz" title="Következő rész" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
        {items.map((m, i) => (
          <motion.div key={m.animeId} {...reveal(i, 0.24)} className="h-full">
            <MediaCard
              title={m.title}
              coverUrl={m.coverUrl}
              genres={m.genres}
              description={m.description}
              href={`/anime/${m.animeId}`}
              badge={
                <span className="surface-2 rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">
                  EP {m.nextEpisode} · <Countdown airingAt={m.airingAt} />
                </span>
              }
              footer={
                <div className="flex items-center justify-between gap-2">
                  <p className="label-mono flex items-center gap-1.5">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${m.status === 'watching' ? 'animate-pulse' : ''}`}
                      style={{ background: STATUS_CSS_VARS[m.status] ?? 'white' }}
                    />
                    {STATUS_LABELS[m.status] ?? m.status}
                    <span className="text-text-3">· {m.progress}{m.episodes ? `/${m.episodes}` : ''}</span>
                  </p>
                  <Button onClick={() => onBump(m)} title="Megnéztem egy részt">+1</Button>
                </div>
              }
            />
          </motion.div>
        ))}
      </div>
    </section>
  )
}
