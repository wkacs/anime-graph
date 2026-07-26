'use client'
import Link from 'next/link'
import SectionHeader from '@/components/ui/SectionHeader'
import { weekdayIndexBudapest, WEEKDAY_LABELS } from '@/lib/news'
import type { MineItem } from './types'

export default function WeekCalendar({ mine }: { mine: MineItem[] }) {
  if (mine.length === 0) return null
  const todayIdx = weekdayIndexBudapest(Math.floor(Date.now() / 1000))

  return (
    <section>
      <SectionHeader eyebrow="Adásnaptár" title="A heted" />
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS.map((label, day) => {
          const items = mine.filter((m) => weekdayIndexBudapest(m.airingAt) === day)
          const today = day === todayIdx
          return (
            <div
              key={label}
              className={`rounded-[var(--r-md)] p-2 min-h-24 ${today ? 'surface-2' : 'surface-1'}`}
            >
              <p className={`label-mono mb-2 text-center ${today ? '!text-text-1' : ''}`}>{label}</p>
              <div className="flex flex-col items-center gap-1.5">
                {items.map((m) => (
                  <Link key={m.animeId} href={`/anime/${m.animeId}`} title={m.title}>
                    {m.coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.coverUrl}
                        alt={m.title}
                        className="w-9 h-12 object-cover rounded-[var(--r-sm)] hover:scale-110 transition-transform"
                      />
                    ) : (
                      <span className="text-[10px] text-text-2">{m.title.slice(0, 8)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
