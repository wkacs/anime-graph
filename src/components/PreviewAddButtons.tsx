'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

const ADD_OPTIONS = ['completed', 'watching', 'planned'] as const

type WatchlistMeta = { title: string; coverUrl: string | null; mediaType: string }

// preview-oldali hozzáadás: siker után átirányít a rendes anime-oldalra
export default function PreviewAddButtons({ anilistId, watchlistMeta }: { anilistId: number; watchlistMeta?: WatchlistMeta }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sharedAdded, setSharedAdded] = useState(false)
  const t = useTranslations('owner')
  const tc = useTranslations('common')

  async function add(status: string) {
    setBusy(true)
    setError('')
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId, status }),
    })
    if (res.ok) {
      const json = await res.json()
      router.push(`/anime/${json.anime.id}`)
    } else {
      setError((await res.json().catch(() => null))?.error ?? tc('error'))
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ADD_OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => add(s)}
          disabled={busy}
          className="btn-ghost glass border border-white/10 rounded-full px-4 py-2 text-sm hover:border-white/30 transition-colors disabled:opacity-50"
        >
          {busy ? '…' : `+ ${t(`add_${s}`)}`}
        </button>
      ))}
      {watchlistMeta && (
        <button
          onClick={async () => {
            const res = await fetch('/api/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ anilistId, ...watchlistMeta }),
            })
            if (res.ok) setSharedAdded(true)
          }}
          disabled={sharedAdded}
          title={t('toSharedTooltip')}
          className="btn-ghost glass border border-white/10 rounded-full px-4 py-2 text-sm hover:border-white/30 transition-colors disabled:text-[color:var(--status-watching)] disabled:border-transparent"
        >
          {sharedAdded ? t('inShared') : t('toShared')}
        </button>
      )}
      {error && <span className="text-sm text-[color:var(--status-dropped)]">{error}</span>}
    </div>
  )
}
