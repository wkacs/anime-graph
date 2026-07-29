'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import PageShell from '@/components/ui/PageShell'
import Skeleton from '@/components/ui/Skeleton'

type Review = {
  id: number; text: string; updatedAt: string; username: string; title: string
  coverUrl: string | null; href: string
}

export default function CommunityPage() {
  const t = useTranslations('community')
  const [items, setItems] = useState<Review[] | null>(null)

  useEffect(() => {
    fetch('/api/reviews')
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((data: { items?: Review[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
  }, [])

  return (
    <PageShell width="narrow" className="flex flex-col gap-8">
      <header>
        <p className="label-mono">{t('eyebrow')}</p>
        <h1 className="display-l mt-2 text-text-1">{t('heading')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-2">{t('description')}</p>
      </header>
      {items == null ? <Skeleton variant="row" count={6} /> : items.length === 0 ? (
        <p className="text-sm text-text-2">{t('empty')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((review) => (
            <li key={review.id} className="surface-1 rounded-[var(--r-lg)] p-4 sm:p-5">
              <div className="flex gap-4">
                <Link href={review.href} className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  {review.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={review.coverUrl} alt="" className="h-20 w-14 rounded-[var(--r-sm)] object-cover" />
                  ) : <div className="h-20 w-14 rounded-[var(--r-sm)] bg-white/5" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <Link href={review.href} className="font-medium text-text-1 hover:underline">{review.title}</Link>
                    <Link href={`/u/${encodeURIComponent(review.username)}`} className="text-xs text-text-2 hover:text-text-1">@{review.username}</Link>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-2">{review.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  )
}
