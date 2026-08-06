'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import SectionHeader from '@/components/ui/SectionHeader'
import { weekdayIndexBudapest, WEEKDAY_KEYS } from '@/lib/news'
import type { MineItem } from './types'

export default function WeekCalendar({ mine }: { mine: MineItem[] }) {
  const t = useTranslations('home')
  const tw = useTranslations('weekday')
  if (mine.length === 0) return null
  const todayIdx = weekdayIndexBudapest(Math.floor(Date.now() / 1000))

  return (
    <section>
      <SectionHeader title={t('yourWeek')} />

      {/* Mobil: CSAK a napok, amikor tényleg jön valami — a korábbi vízszintes
          sáv félbevágott, üres „–" oszlopokat mutatott a jobb szélen, ami
          töröttnek hatott (user-visszajelzés 2026-08-06). */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {WEEKDAY_KEYS.map((key, day) => {
          const label = tw(key)
          const items = mine.filter((m) => weekdayIndexBudapest(m.airingAt) === day)
          if (items.length === 0) return null
          const today = day === todayIdx
          return (
            <div
              key={key}
              aria-current={today ? 'date' : undefined}
              className={`flex gap-3 rounded-[var(--r-md)] p-2.5 ${
                today ? 'surface-2 ring-1 ring-white/15' : 'surface-1'
              }`}
            >
              <p
                className={`w-12 shrink-0 pt-1 text-center text-xs font-medium uppercase tracking-wide ${
                  today ? 'text-text-1' : 'text-text-2'
                }`}
              >
                {label}
              </p>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {items.map((m) => (
                  <Link
                    key={m.animeId}
                    href={`/anime/${m.animeId}`}
                    className="flex items-center gap-2.5"
                  >
                    {m.coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.coverUrl}
                        alt=""
                        loading="lazy"
                        className="w-10 shrink-0 rounded-[var(--r-sm)] object-cover"
                        style={{ aspectRatio: '2 / 3' }}
                      />
                    ) : (
                      <div
                        className="w-10 shrink-0 rounded-[var(--r-sm)] bg-white/5"
                        style={{ aspectRatio: '2 / 3' }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs leading-snug text-text-1">{m.title}</p>
                      {m.nextEpisode > 0 && (
                        <p className="mt-0.5 font-mono text-[10px] tabular-nums text-text-3">
                          EP {m.nextEpisode}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* sm-től a teljes heti rács — ott elfér mind a 7 oszlop */}
      <div className="hidden sm:grid sm:grid-cols-7 gap-2">
        {WEEKDAY_KEYS.map((key, day) => {
          const label = tw(key)
          const items = mine.filter((m) => weekdayIndexBudapest(m.airingAt) === day)
          const today = day === todayIdx
          return (
            <div
              key={key}
              aria-current={today ? 'date' : undefined}
              className={`rounded-[var(--r-md)] p-2 ${
                today ? 'surface-2 ring-1 ring-white/20' : 'surface-1'
              }`}
            >
              <p
                className={`mb-2 text-center text-xs font-medium uppercase tracking-wide ${
                  today ? 'text-text-1' : 'text-text-2'
                }`}
              >
                {label}
              </p>

              {items.length === 0 ? (
                <p className="py-4 text-center text-xs text-text-3" aria-label={t('notAiring')}>
                  -
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {items.map((m) => (
                    <Link
                      key={m.animeId}
                      href={`/anime/${m.animeId}`}
                      title={m.title}
                      className="group block"
                    >
                      <div className="relative">
                        {m.coverUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={m.coverUrl}
                            alt=""
                            loading="lazy"
                            className="w-full rounded-[var(--r-sm)] border border-white/10 object-cover transition-transform group-hover:scale-[1.04]"
                            style={{ aspectRatio: '2 / 3' }}
                          />
                        ) : (
                          <div
                            className="w-full rounded-[var(--r-sm)] bg-white/5"
                            style={{ aspectRatio: '2 / 3' }}
                          />
                        )}
                        {m.nextEpisode > 0 && (
                          <span className="surface-3 absolute bottom-1 right-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-text-1">
                            {m.nextEpisode}.
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-text-2 group-hover:text-text-1">
                        {m.title}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
