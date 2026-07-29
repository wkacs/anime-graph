'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import PageShell from '@/components/ui/PageShell'
import Skeleton from '@/components/ui/Skeleton'

type Item = { anilistId: number; title: string; coverUrl: string | null; episode: number; airingAt: number; href: string }

function timeLabel(unix: number, nowLabel: string) {
  const delta = unix * 1000 - Date.now()
  if (delta <= 0) return nowLabel
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(unix * 1000))
}

export default function NotificationsPage() {
  const t = useTranslations('notifications')
  const [items, setItems] = useState<Item[] | null>(null)
  useEffect(() => {
    fetch('/api/notifications')
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: { items?: Item[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
  }, [])

  return (
    <PageShell width="narrow" className="flex flex-col gap-8">
      <header>
        <p className="label-mono">{t('eyebrow')}</p>
        <h1 className="display-l mt-2 text-text-1">{t('heading')}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-2">{t('description')}</p>
      </header>
      {items == null ? <Skeleton variant="row" count={5} /> : items.length === 0 ? (
        <p className="text-sm text-text-2">{t('empty')}</p>
      ) : (
        <ol className="surface-1 divide-y divide-white/5 rounded-[var(--r-lg)] px-3">
          {items.map((item) => (
            <li key={item.anilistId}>
              <Link href={item.href} className="flex items-center gap-4 rounded-[var(--r-md)] px-2 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.coverUrl} alt="" className="h-14 w-10 rounded-[var(--r-sm)] object-cover" />
                ) : <div className="h-14 w-10 rounded-[var(--r-sm)] bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text-1">{item.title}</p>
                  <p className="mt-0.5 text-xs text-text-2">{t('episode', { episode: item.episode })}</p>
                </div>
                <time dateTime={new Date(item.airingAt * 1000).toISOString()} className="shrink-0 text-right text-xs text-text-2">
                  {timeLabel(item.airingAt, t('now'))}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  )
}
