'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { LeaderboardTab } from '@/lib/leaderboard'

type Row = {
  rank: number; id: number; slug: string; mediaType: string; titleRomaji: string
  coverUrl: string | null; genres: string[]; avgScore: number | null
  communityScore: number | null; communityCount: number; popularity: number
}

const TABS: { id: LeaderboardTab; label: string; hint: string }[] = [
  { id: 'sajat', label: 'Nálunk', hint: 'a mi értékeléseink (bayesian átlag, min. 2 pontozó)' },
  { id: 'anilist', label: 'AniList', hint: 'AniList átlagpontszám a teljes katalóguson' },
  { id: 'nepszeru', label: 'Legnézettebb', hint: 'hányan vettük fel a listánkra' },
]

// az AniList zárt genre-halmaza, ahogy a title.genres tárolja
const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo',
  'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
]

export default function ToplistaPage() {
  const [tab, setTab] = useState<LeaderboardTab>('anilist')
  const [type, setType] = useState<'ANIME' | 'MANGA'>('ANIME')
  const [genre, setGenre] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    setError('')
    const qs = new URLSearchParams({ tab, type })
    if (genre) qs.set('genre', genre)
    fetch(`/api/leaderboard?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
        const j = await r.json() as { items: Row[] }
        setRows(j.items)
      })
      .catch((e) => setError(String(e.message ?? e)))
  }, [tab, type, genre])

  const activeTab = TABS.find((t) => t.id === tab)!

  function metric(r: Row): string {
    if (tab === 'sajat') return r.communityScore != null ? `★ ${r.communityScore.toFixed(1)} · ${r.communityCount} pontozó` : '–'
    if (tab === 'nepszeru') return `${r.popularity} listán`
    return r.avgScore != null ? `${r.avgScore}%` : '–'
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-5">
      <div>
        <p className="label-mono mb-1">Toplista</p>
        <h1 className="text-2xl font-semibold tracking-tight">A legjobbra értékelt címek</h1>
        <p className="text-sm text-text-2 mt-1">{activeTab.hint}</p>
      </div>

      <div className="glass rounded-3xl p-4 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                tab === t.id ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {(['ANIME', 'MANGA'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors ${
                type === t ? 'bg-white/10 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {t === 'ANIME' ? 'Anime' : 'Manga'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setGenre(null)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            genre === null ? 'border-white/40 text-text-1' : 'border-white/10 text-text-2 hover:text-text-1'
          }`}
        >
          Minden műfaj
        </button>
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(genre === g ? null : g)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              genre === g ? 'border-white/40 text-text-1' : 'border-white/10 text-text-2 hover:text-text-1'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}
      {rows == null && !error && (
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
          Betöltés…
        </motion.p>
      )}
      {rows != null && rows.length === 0 && (
        <p className="text-sm text-text-2">
          {tab === 'sajat'
            ? 'Ehhez még kevés a házon belüli értékelés — pontozzatok, és épül a lista.'
            : 'Nincs találat ezzel a szűrővel.'}
        </p>
      )}

      {rows != null && rows.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/${r.mediaType === 'MANGA' ? 'manga' : 'anime'}/${r.slug}`}
                className="glass rounded-2xl p-3 flex items-center gap-3 hover:bg-white/6 transition-colors"
              >
                <span className={`font-mono text-sm w-8 shrink-0 text-right tabular-nums ${
                  r.rank <= 3 ? 'text-text-1 font-semibold' : 'text-text-3'
                }`}>
                  {r.rank}.
                </span>
                {r.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverUrl} alt="" className="w-9 aspect-[2/3] object-cover rounded-lg border border-white/8 shrink-0" />
                ) : (
                  <div className="w-9 aspect-[2/3] rounded-lg bg-white/5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.titleRomaji}</p>
                  <p className="text-[11px] text-text-3 truncate">{r.genres.slice(0, 3).join(' · ')}</p>
                </div>
                <span className="label-mono shrink-0">{metric(r)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
