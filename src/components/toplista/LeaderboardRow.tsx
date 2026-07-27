import Link from 'next/link'
import type { LeaderRow } from '@/lib/leaderboard-metric'
import MetricValue from './MetricValue'
import type { LeaderboardTab } from '@/lib/leaderboard'

type Props = { row: LeaderRow; tab: LeaderboardTab }

// A 4. helytol lefele: tipografiai sor, NINCS kartya-doboz es nincs hajszalvonal
// minden soron. A rangsort a szamok es a terkoz tartja, a hover adja a
// kattinthatosag-jelzest. (Korabban 30 egyforma glass-doboz allt egymason:
// a #1 pontosan ugy nezett ki, mint a #30 — vagyis nulla hierarchia.)
export default function LeaderboardRow({ row, tab }: Props) {
  const href = `/${row.mediaType === 'MANGA' ? 'manga' : 'anime'}/${row.slug}`

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[var(--r-md)] px-3 py-2.5 -mx-3 transition-colors hover:bg-white/[0.045]"
    >
      <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-text-3">
        {row.rank}
      </span>

      {row.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.coverUrl}
          alt=""
          loading="lazy"
          className="w-8 aspect-[2/3] shrink-0 rounded-[var(--r-sm)] border border-white/8 object-cover"
        />
      ) : (
        <div className="w-8 aspect-[2/3] shrink-0 rounded-[var(--r-sm)] bg-white/5" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-1">{row.titleRomaji}</p>
        <p className="truncate text-[11px] text-text-3">{row.genres.slice(0, 3).join(', ')}</p>
      </div>

      <span className="shrink-0">
        <MetricValue row={row} tab={tab} size="sm" />
      </span>
    </Link>
  )
}
