'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SearchResult } from '@/lib/anilist'
import type { TitleHit } from '@/lib/search'
import type { ApiAnime } from '@/lib/types'

const ADD_OPTIONS = ['completed', 'watching', 'planned'] as const

export default function AddAnimeSearch({
  onAdded,
  ownList = [],
  onPickOwn,
}: {
  onAdded: (anime?: ApiAnime) => void
  // ha megvan: a saját lista találatai is megjelennek, kattintásra onPickOwn
  ownList?: ApiAnime[]
  onPickOwn?: (anime: ApiAnime) => void
}) {
  const [q, setQ] = useState('')
  const [mediaType, setMediaType] = useState<'ANIME' | 'MANGA'>('ANIME')
  const [results, setResults] = useState<TitleHit[]>([])
  // AniList fallback for titles not yet in our catalog
  const [fallback, setFallback] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  // `tr`, nem `t`: a media-valto map parametere `t`, az arnyekolna.
  const tr = useTranslations('addSearch')

  const needle = q.trim().toLowerCase()
  const ownMatches = onPickOwn && needle.length >= 2
    ? ownList.filter((a) =>
        a.titleRomaji.toLowerCase().includes(needle) ||
        (a.titleEnglish ?? '').toLowerCase().includes(needle),
      ).slice(0, 4)
    : []

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setFallback([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&type=${mediaType}&limit=8`)
      if (!res.ok) return
      const { hits } = await res.json() as { hits: TitleHit[] }
      setResults(hits)
      if (hits.length === 0) {
        // nothing in the catalog yet -> AniList fallback so brand-new titles are addable
        const fb = await fetch(`/api/anilist/search?q=${encodeURIComponent(q.trim())}&type=${mediaType}`)
        setFallback(fb.ok ? (await fb.json()).results : [])
      } else {
        setFallback([])
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q, mediaType])

  function done(anime?: ApiAnime) {
    setQ(''); setResults([]); setFallback([]); onAdded(anime)
  }

  async function addByTitle(titleId: number, status: string) {
    setBusy(titleId)
    const res = await fetch('/api/anime', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleId, status }),
    })
    setBusy(null)
    if (res.ok) done((await res.json()).anime)
  }

  async function addByAnilist(anilistId: number, status: string) {
    setBusy(anilistId)
    const res = await fetch('/api/anime', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId, status }),
    })
    setBusy(null)
    if (res.ok) done((await res.json()).anime)
  }

  const hasResults = results.length > 0 || fallback.length > 0 || ownMatches.length > 0

  return (
    // w-full + max-w, NEM w-[min(85vw,20rem)]: a kötött 85vw figyelmen kívül
    // hagyta a szülő flex-résést, és a gráfon ráfutott az „Ajánlj nekem"
    // gombra. Így a szülő szabja meg a szélességet, a max-w csak plafon.
    <div className="relative w-full max-w-80 text-sm">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={mediaType === 'ANIME' ? tr('placeholderAnime') : tr('placeholderManga')}
          className="field surface-overlay w-full rounded-full px-4 py-2.5 pr-24"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex rounded-full border border-white/10 overflow-hidden">
          {(['ANIME', 'MANGA'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMediaType(t)}
              className={`px-2 py-1 text-[9px] font-mono uppercase tracking-wide transition-colors ${
                mediaType === t ? 'bg-white/10 text-text-1' : 'text-text-3 hover:text-text-1'
              }`}
            >
              {t === 'ANIME' ? 'A' : 'M'}
            </button>
          ))}
        </div>
      </div>
      {hasResults && (
        <ul className="surface-menu absolute mt-2 w-full max-h-80 overflow-auto rounded-2xl p-1.5 z-20">
          {ownMatches.length > 0 && (
            <li className="label-mono px-2 pt-1 pb-0.5">{tr('onYourListJump')}</li>
          )}
          {ownMatches.map((a) => (
            <li key={`own-${a.id}`}>
              <button
                onClick={() => { setQ(''); setResults([]); setFallback([]); onPickOwn!(a) }}
                className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/8 text-left transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.coverUrl && <img src={a.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
                <span className="flex-1 min-w-0 text-text-1">
                  <span className="block truncate">{a.titleRomaji}</span>
                  <span className="block text-xs text-text-3 font-mono">{a.year ?? '?'} · {tr('onYourList')}</span>
                </span>
                <span className="text-text-3">→</span>
              </button>
            </li>
          ))}
          {results.length > 0 && ownMatches.length > 0 && (
            <li className="label-mono px-2 pt-2 pb-0.5">{tr('addHeading')}</li>
          )}
          {results.map((h) => (
            <li key={`t-${h.titleId}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/8 transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {h.coverUrl && <img src={h.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
              <span className="flex-1 min-w-0 text-text-1">
                <span className="block truncate">{h.titleRomaji}</span>
                <span className="block text-xs text-text-3 font-mono">{h.year ?? '?'} · {h.format ?? '?'}</span>
              </span>
              {busy === h.titleId ? (
                <span className="text-text-2 px-2">…</span>
              ) : (
                <span className="flex gap-1 shrink-0">
                  {ADD_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => addByTitle(h.titleId, s)}
                      disabled={busy !== null}
                      title={tr('addAs', { label: tr(`add_${s}`) })}
                      className="rounded-full border border-white/12 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors"
                    >
                      {tr(`add_${s}`)}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
          {fallback.length > 0 && (
            <li className="label-mono px-2 pt-2 pb-0.5">{tr('notInCatalogue')}</li>
          )}
          {fallback.map((r) => (
            <li key={`a-${r.anilistId}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/8 transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.coverUrl && <img src={r.coverUrl} alt="" className="w-8 h-11 object-cover rounded-md" />}
              <span className="flex-1 min-w-0 text-text-1">
                <span className="block truncate">{r.titleRomaji}</span>
                <span className="block text-xs text-text-3 font-mono">{r.year ?? '?'} · {r.format ?? '?'}</span>
              </span>
              {busy === r.anilistId ? (
                <span className="text-text-2 px-2">…</span>
              ) : (
                <span className="flex gap-1 shrink-0">
                  {ADD_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => addByAnilist(r.anilistId, s)}
                      disabled={busy !== null}
                      title={tr('addAs', { label: tr(`add_${s}`) })}
                      className="rounded-full border border-white/12 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors"
                    >
                      {tr(`add_${s}`)}
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
