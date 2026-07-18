'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Countdown from '@/components/Countdown'
import RecommendMorph from '@/components/RecommendMorph'
import { SEASON_LABELS } from '@/lib/seasonal'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'

type MineItem = {
  animeId: number
  anilistId: number
  title: string
  coverUrl: string | null
  status: string
  progress: number
  episodes: number | null
  airingAt: number
  nextEpisode: number
}

type SeasonItem = {
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  avgScore: number | null
  episodes: number | null
  format: string | null
  airingAt: number | null
  nextEpisode: number | null
  owned: boolean
  tasteScore: number | null
  tasteReason: string | null
}

type NewsData = {
  season: { season: string; year: number }
  mine: MineItem[]
  seasonItems: SeasonItem[]
}

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [digest, setDigest] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/news')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
        setData(await r.json())
      })
      .catch((e) => setError(String(e.message ?? e)))
    // digest külön csatornán jön, nem lassítja az oldalt
    fetch('/api/digest')
      .then((r) => r.json())
      .then((j) => setDigest(j.digest ?? null))
      .catch(() => { /* digest nélkül is él az oldal */ })
  }, [])

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAdded((s) => new Set(s).add(anilistId))
  }

  async function bumpProgress(m: MineItem) {
    const res = await fetch(`/api/anime/${m.animeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: m.progress + 1 }),
    })
    if (res.ok && data) {
      setData({
        ...data,
        mine: data.mine.map((x) => (x.animeId === m.animeId ? { ...x, progress: x.progress + 1 } : x)),
      })
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-3xl px-10 py-12 text-center">
          <p className="label-mono mb-2">News</p>
          <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="label-mono"
        >
          Adások betöltése…
        </motion.p>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-mono mb-1">News</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.season.year} {SEASON_LABELS[data.season.season] ?? data.season.season}
          </h1>
        </div>
        <RecommendMorph onAdded={() => { /* a lista frissül a következő betöltéskor */ }} />
      </div>

      {digest && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl px-5 py-3.5 text-sm text-text-1 leading-relaxed -mt-3"
        >
          <span className="label-mono mr-2">✦ ma</span>
          {digest}
        </motion.p>
      )}

      {data.mine.length > 0 && (
        <section>
          <p className="label-mono mb-3">Amit követsz — következő rész</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.mine.map((m, i) => (
              <motion.div
                key={m.animeId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
              >
                <div className="glass rounded-2xl p-3 flex gap-3 hover:bg-white/8 transition-colors h-full relative">
                  <Link href={`/anime/${m.animeId}`} className="absolute inset-0" aria-label={m.title} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.coverUrl && <img src={m.coverUrl} alt="" className="w-12 rounded-lg object-cover self-start" />}
                  <div className="min-w-0 flex flex-col flex-1">
                    <p className="text-[13px] font-medium leading-tight line-clamp-2">{m.title}</p>
                    <p className="label-mono mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${m.status === 'watching' ? 'animate-pulse' : ''}`}
                        style={{ background: STATUS_CSS_VARS[m.status] ?? 'white' }}
                      />
                      {STATUS_LABELS[m.status] ?? m.status}
                      <span className="text-text-3">· {m.progress}{m.episodes ? `/${m.episodes}` : ''} rész</span>
                    </p>
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <p className="font-mono text-sm text-text-1">
                        EP {m.nextEpisode} · <Countdown airingAt={m.airingAt} />
                      </p>
                      <button
                        onClick={() => bumpProgress(m)}
                        title="Megnéztem egy részt"
                        className="btn-ghost relative z-10 border border-white/10 px-2 py-0.5 text-xs whitespace-nowrap"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <p className="label-mono">A szezon</p>
          <Link href="/szezon" className="label-mono hover:text-text-1 transition-colors">
            Ízlés-pontozás →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.seasonItems.map((s, i) => (
            <motion.article
              key={s.anilistId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
              className="glass rounded-3xl p-4 flex gap-4"
            >
              {s.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.coverUrl} alt="" className="w-16 rounded-xl object-cover self-start" />
              ) : (
                <div className="w-16 aspect-[2/3] rounded-xl bg-white/5 self-start" />
              )}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium leading-tight">{s.title}</h2>
                  {s.tasteScore != null && (
                    <span
                      className="font-mono text-sm font-semibold tabular-nums shrink-0"
                      title={s.tasteReason ?? undefined}
                      style={{ color: s.tasteScore >= 75 ? 'var(--status-watching)' : 'var(--text-2)' }}
                    >
                      {s.tasteScore}
                    </span>
                  )}
                </div>
                <p className="label-mono mt-0.5">{s.genres.slice(0, 3).join(' · ')}</p>
                <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                  <p className="font-mono text-[13px] text-text-1">
                    {s.airingAt != null ? (
                      <>EP {s.nextEpisode} · <Countdown airingAt={s.airingAt} /></>
                    ) : (
                      <span className="text-text-3">nincs adásban</span>
                    )}
                  </p>
                  {s.owned ? (
                    <span className="label-mono text-[color:var(--status-watching)]">listádon</span>
                  ) : (
                    <button
                      onClick={() => addToPlanned(s.anilistId)}
                      disabled={added.has(s.anilistId)}
                      className="btn-ghost border border-white/10 px-2.5 py-1 text-xs whitespace-nowrap disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                    >
                      {added.has(s.anilistId) ? '✓' : '+ Tervezem'}
                    </button>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </main>
  )
}
