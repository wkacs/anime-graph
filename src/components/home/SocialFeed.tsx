'use client'
import Link from 'next/link'
import SectionHeader from '@/components/ui/SectionHeader'
import Button from '@/components/ui/Button'
import type { FeedItem, WatchItem } from './types'

type Props = {
  feed: FeedItem[]
  watchlist: WatchItem[]
  usernames: Record<number, string>
  onWatchBump: (w: WatchItem) => void
  onWatchRemove: (w: WatchItem) => void
}

export default function SocialFeed({ feed, watchlist, usernames, onWatchBump, onWatchRemove }: Props) {
  if (feed.length === 0 && watchlist.length === 0) return null

  return (
    <section>
      <SectionHeader eyebrow="Társaság" title="Mi történt" />

      {feed.length > 0 && (
        <div className="surface-1 rounded-[var(--r-lg)] p-4 flex flex-col gap-2.5">
          {feed.slice(0, 12).map((f) => (
            <div key={`${f.kind}-${f.userId}-${f.animeId}-${f.at}`} className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 shrink-0 rounded-full bg-white/8 grid place-items-center font-mono text-[11px] uppercase text-text-1">
                {f.username.slice(0, 2)}
              </span>
              <p className="min-w-0 flex-1 text-text-2 truncate">
                <span className="text-text-1 font-medium">{f.username}</span>{' '}
                {f.kind === 'added' && <>hozzáadta: </>}
                {f.kind === 'opinion' && <>véleményt írt: </>}
                {f.kind === 'episodes' && <>{f.mediaType === 'MANGA' ? 'olvasott' : 'nézett'} ({f.count > 1 ? `${f.count} rész` : f.detail}): </>}
                {f.kind === 'favchar' && <>kedvence lett: {f.detail} — </>}
                <Link href={`/anime/preview/${f.anilistId}`} className="text-text-1 hover:underline">{f.title}</Link>
                {f.kind === 'opinion' && f.detail && <span className="text-text-3"> — „{f.detail}”</span>}
              </p>
              <span className="label-mono shrink-0">
                {new Date(f.at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {watchlist.length > 0 && (
        <div className="mt-5">
          <p className="label-mono mb-2">Közös lista</p>
          <ul className="flex flex-col gap-2">
            {watchlist.map((w) => (
              <li key={w.id} className="surface-1 rounded-[var(--r-md)] p-2.5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {w.coverUrl && <img src={w.coverUrl} alt="" className="w-8 h-11 object-cover rounded-[var(--r-sm)]" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/anime/preview/${w.anilistId}`} className="text-sm font-medium text-text-1 truncate block hover:underline">
                    {w.title}
                  </Link>
                  <p className="label-mono">{usernames[w.addedBy] ?? '?'} tette fel · együtt: {w.watchedEpisodes} rész</p>
                </div>
                <Button onClick={() => onWatchBump(w)} title="Együtt megnéztünk egy részt">+1</Button>
                <Button variant="ghost" onClick={() => onWatchRemove(w)} title="Levétel" className="text-text-3">✕</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
