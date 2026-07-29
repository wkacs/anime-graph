import Link from 'next/link'
import PosterAmbient from '@/components/ui/PosterAmbient'
import MetricValue from './MetricValue'
import type { LeaderRow } from '@/lib/leaderboard-metric'
import type { LeaderboardTab } from '@/lib/leaderboard'

type Props = { rows: LeaderRow[]; tab: LeaderboardTab }

function href(r: LeaderRow) {
  return `/${r.mediaType === 'MANGA' ? 'manga' : 'anime'}/${r.slug}`
}

// A rangszam a poszter sarkara ul, nem mellette foglal oszlopot. Igy a
// szamnak megmarad a display-merete anelkul, hogy a cimtol venne el a helyet.
function Poster({ row, w, rankClass }: { row: LeaderRow; w: string; rankClass: string }) {
  return (
    <div className={`relative shrink-0 ${w}`}>
      {row.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.coverUrl}
          alt=""
          className="w-full rounded-[var(--r-md)] border border-white/10 object-cover shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          style={{ aspectRatio: '2 / 3' }}
        />
      ) : (
        <div className="w-full rounded-[var(--r-md)] bg-white/5" style={{ aspectRatio: '2 / 3' }} />
      )}
      <span
        className={`${rankClass} pointer-events-none absolute -bottom-1 -left-2 leading-none text-text-1`}
        style={{ textShadow: '0 2px 12px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.6)' }}
      >
        {row.rank}
      </span>
    </div>
  )
}

export default function Podium({ rows, tab }: Props) {
  const [first, ...rest] = rows
  if (!first) return null

  return (
    <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
      <Link
        href={href(first)}
        className="surface-2 relative isolate overflow-hidden rounded-[var(--r-lg)] p-5 transition-transform active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <PosterAmbient src={first.coverUrl} intensity="hero" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-black/15" aria-hidden />
        <div className="relative flex items-center gap-6">
          <Poster row={first} w="w-28 sm:w-32" rankClass="display-xl" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 text-base font-semibold text-text-1 sm:text-lg">{first.titleRomaji}</p>
            {/* text-2, nem text-3: ez a szoveg a poszter-ambiens FELETT all,
                ahol a text-3 nem hozhato AA-ra (lasd globals.css). */}
            <p className="mt-1 truncate text-xs text-text-2">{first.genres.slice(0, 3).join(', ')}</p>
            <div className="mt-4"><MetricValue row={first} tab={tab} size="lg" /></div>
          </div>
        </div>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
        {rest.map((r) => (
          <Link
            key={r.id}
            href={href(r)}
            className="surface-1 relative isolate flex items-center gap-4 overflow-hidden rounded-[var(--r-md)] p-3 pl-4 transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <PosterAmbient src={r.coverUrl} intensity="row" />
            <div className="absolute inset-0 bg-black/35" aria-hidden />
            <Poster row={r} w="w-12" rankClass="display-l" />
            <p className="relative line-clamp-2 min-w-0 flex-1 text-sm font-medium text-text-1">
              {r.titleRomaji}
            </p>
            <div className="relative shrink-0"><MetricValue row={r} tab={tab} size="md" /></div>
          </Link>
        ))}
      </div>
    </div>
  )
}
