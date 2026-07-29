'use client'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import type { FeedItem, WatchItem } from './types'

type Props = {
  feed: FeedItem[]
  watchlist: WatchItem[]
  onWatchBump: (w: WatchItem) => void
  onWatchRemove: (w: WatchItem) => void
}

export default function SocialFeed({ feed, watchlist, onWatchBump, onWatchRemove }: Props) {
  const t = useTranslations('home')
  const locale = useLocale()
  if (feed.length === 0 && watchlist.length === 0) return null

  return (
    <section>
      <SectionHeader eyebrow={t('socialEyebrow')} title={t('socialTitle')} />

      {feed.length > 0 && (
        <div className="surface-1 rounded-[var(--r-lg)] p-4 flex flex-col gap-2.5">
          {feed.slice(0, 12).map((f) => (
            <div key={`${f.kind}-${f.userId}-${f.animeId}-${f.at}`} className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 shrink-0 rounded-full bg-white/8 grid place-items-center font-mono text-[11px] uppercase text-text-1">
                {f.username.slice(0, 2)}
              </span>
              <p className="min-w-0 flex-1 text-text-2 truncate">
                <span className="text-text-1 font-medium">{f.username}</span>{' '}
                {f.kind === 'added' && <>{t('feedAdded')} </>}
                {f.kind === 'opinion' && <>{t('feedOpinion')} </>}
                {f.kind === 'episodes' && (
                  <>
                    {f.mediaType === 'MANGA' ? t('feedRead') : t('feedWatched')}{' '}
                    ({f.count > 1 ? t('feedEpisodeCount', { count: f.count }) : f.detail}):{' '}
                  </>
                )}
                {f.kind === 'favchar' && <>{t('feedFavourite')} {f.detail} — </>}
                <Link href={`/anime/preview/${f.anilistId}`} className="text-text-1 hover:underline">{f.title}</Link>
                {f.kind === 'opinion' && f.detail && <span className="text-text-3"> — „{f.detail}”</span>}
              </p>
              <span className="label-mono shrink-0">
                {new Date(f.at).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {watchlist.length > 0 && (
        <div className="mt-5">
          <p className="label-mono mb-2">{t('myWatchlist')}</p>
          <ul className="flex flex-col gap-2">
            {watchlist.map((w) => (
              <li key={w.id} className="surface-1 rounded-[var(--r-md)] p-2.5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.coverUrl && <img src={w.coverUrl} alt="" className="w-8 h-11 object-cover rounded-[var(--r-sm)]" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/anime/preview/${w.anilistId}`} className="text-sm font-medium text-text-1 truncate block hover:underline">
                    {w.title}
                  </Link>
                  <p className="label-mono">
                    {t('watchedEpisodes', { count: w.watchedEpisodes })}
                  </p>
                </div>
                <Button onClick={() => onWatchBump(w)} title={t('markWatched')}>+1</Button>
                <Button variant="ghost" onClick={() => onWatchRemove(w)} title={t('remove')} className="text-text-3">✕</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
