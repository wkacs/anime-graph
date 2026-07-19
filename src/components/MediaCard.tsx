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
}

// vertikális média-kártya: borító → cím → halvány műfaj → rövid leírás → footer-slot
export default function MediaCard({ title, coverUrl, genres, description, href, badge, footer, streaming }: Props) {
  const desc = clampText(stripHtml(description ?? null))
  const cover = (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-white/5">
      {coverUrl && (
        <Image src={coverUrl} alt={title} fill sizes="220px" className="object-cover" />
      )}
      {badge && <div className="absolute top-2 right-2">{badge}</div>}
    </div>
  )
  return (
    <div className="glass rounded-2xl p-3 flex flex-col gap-2">
      {href ? <Link href={href}>{cover}</Link> : cover}
      <div className="min-w-0">
        {href
          ? <Link href={href} className="text-sm font-medium text-text-1 line-clamp-2 hover:underline">{title}</Link>
          : <span className="text-sm font-medium text-text-1 line-clamp-2">{title}</span>}
        <p className="text-[11px] text-text-3 truncate">{genres.slice(0, 3).join(' · ')}</p>
        {streaming && streaming.length > 0 && (
          <div className="flex gap-1 mt-1">
            {streaming.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.site}
                className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-2 hover:text-text-1">
                {s.site.slice(0, 4)}
              </a>
            ))}
          </div>
        )}
        {desc && <p className="mt-1 text-xs text-text-2 line-clamp-3">{desc}</p>}
      </div>
      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  )
}
