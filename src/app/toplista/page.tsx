'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { reveal } from '@/lib/motion'
import { Reveal } from '@/components/ui/Reveal'
import { useTranslations } from 'next-intl'
import PageShell from '@/components/ui/PageShell'
import Skeleton from '@/components/ui/Skeleton'
import Podium from '@/components/toplista/Podium'
import LeaderboardRow from '@/components/toplista/LeaderboardRow'
import type { LeaderRow } from '@/lib/leaderboard-metric'
import type { LeaderboardTab } from '@/lib/leaderboard'

const TABS: { id: LeaderboardTab; labelKey: string; hintKey: string }[] = [
  { id: 'sajat', labelKey: 'tabOwn', hintKey: 'hintOwn' },
  { id: 'anilist', labelKey: 'tabAnilist', hintKey: 'hintAnilist' },
  { id: 'nepszeru', labelKey: 'tabPopular', hintKey: 'hintPopular' },
]

// az AniList zárt genre-halmaza, ahogy a title.genres tárolja
const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo',
  'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
]

export default function ToplistaPage() {
  const t = useTranslations('leaderboard')
  const [tab, setTab] = useState<LeaderboardTab>('anilist')
  const [type, setType] = useState<'ANIME' | 'MANGA'>('ANIME')
  const [genre, setGenre] = useState<string | null>(null)
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    setError('')
    const qs = new URLSearchParams({ tab, type })
    if (genre) qs.set('genre', genre)
    fetch(`/api/leaderboard?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Request failed')
        const j = await r.json() as { items: LeaderRow[] }
        setRows(j.items)
      })
      .catch((e) => setError(String(e.message ?? e)))
  }, [tab, type, genre])

  const activeTab = TABS.find((x) => x.id === tab)!
  const podium = rows?.slice(0, 3) ?? []
  const restRows = rows?.slice(3) ?? []

  return (
    <PageShell className="flex flex-col gap-6">
      {/* Nincs „TOPLISTA" eyebrow a cím fölött: pontosan azt ismételte, amit a
          cím és a nav amúgy is elmond. */}
      <header>
        <h1 className="display-l text-text-1">{t('heading')}</h1>
        <p className="mt-1.5 text-sm text-text-2">{t(activeTab.hintKey)}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-white/10">
          {/* a ciklusváltozó NEM `t`: elfedné a fordító függvényt */}
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`px-3.5 py-1.5 text-xs transition-colors ${
                tab === item.id ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-full border border-white/10">
          {(['ANIME', 'MANGA'] as const).map((mt) => (
            <button
              key={mt}
              onClick={() => setType(mt)}
              aria-pressed={type === mt}
              className={`px-3.5 py-1.5 text-xs transition-colors ${
                type === mt ? 'bg-white/10 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {mt === 'ANIME' ? t('anime') : t('manga')}
            </button>
          ))}
        </div>
      </div>

      {/* 18 műfaj korábban három sorba tördelve elvitte az első képernyőt.
          Vízszintes snap-sáv: egy sor magas, a tartalom feljebb kerül. */}
      <div className="snap-row no-scrollbar snap-fade -mx-4 px-4" style={{ gap: 'var(--sp-2)' }}>
        <button
          onClick={() => setGenre(null)}
          aria-pressed={genre === null}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
            genre === null ? 'border-white/40 text-text-1' : 'border-white/10 text-text-2 hover:text-text-1'
          }`}
        >
          {t('allGenres')}
        </button>
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(genre === g ? null : g)}
            aria-pressed={genre === g}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
              genre === g ? 'border-white/40 text-text-1' : 'border-white/10 text-text-2 hover:text-text-1'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {/* Vázlat a végleges elrendezés alakjában, nem pulzáló „Betöltés…" felirat. */}
      {rows == null && !error && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
            <div className="surface-1 rounded-[var(--r-lg)] p-5">
              <div className="flex gap-5">
                <div className="w-28 shrink-0 sm:w-32"><Skeleton variant="poster" count={1} /></div>
                <div className="flex-1 pt-2"><Skeleton variant="text" count={3} /></div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="surface-1 rounded-[var(--r-md)] p-3"><Skeleton variant="row" count={1} /></div>
              <div className="surface-1 rounded-[var(--r-md)] p-3"><Skeleton variant="row" count={1} /></div>
            </div>
          </div>
          <div className="flex flex-col gap-3"><Skeleton variant="row" count={8} /></div>
        </div>
      )}

      {rows != null && rows.length === 0 && (
        <p className="text-sm text-text-2">
          {tab === 'sajat' ? t('emptyOwn') : t('emptyFiltered')}
        </p>
      )}

      {rows != null && rows.length > 0 && (
        <div className="flex flex-col gap-6">
          <Reveal><Podium rows={podium} tab={tab} /></Reveal>
          {restRows.length > 0 && (
            <ol className="flex flex-col">
              {restRows.map((r, i) => (
                <motion.li key={r.id} {...reveal(i % 10)}>
                  <LeaderboardRow row={r} tab={tab} />
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      )}
    </PageShell>
  )
}
