import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { stripHtml, clampText } from '@/lib/description'

type StreamLink = { site: string; url: string }

type Props = {
  title: string
  coverUrl: string | null
  genres: string[]
  description?: string | null
  href?: string
  badge?: ReactNode
  footer?: ReactNode
  streaming?: StreamLink[]
  variant?: 'poster' | 'row'
}

// Filmplakat-ritmus: a poszter MAGA a kartya, nincs uveg-keret korulotte.
// A leiras csak hoverre csuszik be — korabban mindig ott allt 3 sorban es
// telezsufolta a racsot.
export default function MediaCard({
  title, coverUrl, genres, description, href, badge, footer, streaming, variant = 'poster',
}: Props) {
  const desc = clampText(stripHtml(description ?? null))

  if (variant === 'row') {
    const inner = (
      <>
        <div className="relative w-10 h-14 shrink-0 overflow-hidden rounded-[var(--r-sm)] bg-white/5">
          {coverUrl && <Image src={coverUrl} alt="" fill sizes="32px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-text-1 truncate">{title}</p>
          {genres.length > 0 && (
            <p className="font-mono text-[10px] text-text-3 truncate">{genres.slice(0, 2).join(' · ')}</p>
          )}
        </div>
        {badge}
      </>
    )
    return (
      <div className="group relative flex items-center gap-3 rounded-[var(--r-md)] px-2 py-2 hover:bg-white/4 transition-colors">
        {href ? (
          <Link href={href} className="flex items-center gap-3 min-w-0 flex-1">{inner}</Link>
        ) : inner}
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    )
  }

  const cover = (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[var(--r-md)] bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      {coverUrl && (
        <Image
          src={coverUrl}
          alt={title}
          fill
          sizes="220px"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      )}
      {/* labazat a badge olvashatosagahoz */}
      {badge && (
        <>
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
          <div className="absolute top-2 right-2">{badge}</div>
        </>
      )}
      {/* a leiras hoverre csuszik be a poszter aljara */}
      {desc && (
        <div className="absolute inset-x-0 bottom-0 p-3 pt-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out pointer-events-none">
          <p className="text-[11px] text-text-1/90 leading-snug line-clamp-4">{desc}</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="group relative flex flex-col gap-2">
      {/* a poszter sajat szine izzik a kartya alatt hoverre */}
      {coverUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={coverUrl} alt="" aria-hidden className="poster-glow opacity-0 group-hover:opacity-60" />
      )}
      {href ? <Link href={href}>{cover}</Link> : cover}
      <div className="min-w-0">
        {href ? (
          <Link
            href={href}
            className="text-[15px] font-medium text-text-1 line-clamp-2 leading-snug hover:underline decoration-white/25 underline-offset-4"
          >
            {title}
          </Link>
        ) : (
          <span className="text-[15px] font-medium text-text-1 line-clamp-2 leading-snug">{title}</span>
        )}
        {genres.length > 0 && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-3 truncate">
            {genres.slice(0, 2).join(' · ')}
          </p>
        )}
        {streaming && streaming.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {streaming.map((s) => (
              <a
                key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.site}
                className="rounded-[var(--r-sm)] bg-white/8 px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-2 hover:text-text-1"
              >
                {s.site.slice(0, 4)}
              </a>
            ))}
          </div>
        )}
      </div>
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  )
}
