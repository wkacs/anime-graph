'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Countdown from '@/components/Countdown'
import MediaCard from '@/components/MediaCard'
import RecommendMorph from '@/components/RecommendMorph'
import TonightPicker from '@/components/TonightPicker'
import { weekdayIndexBudapest, WEEKDAY_LABELS } from '@/lib/news'
import { SEASON_LABELS } from '@/lib/seasonal'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { FeedItem } from '@/lib/feed'

type MineItem = {
  animeId: number
  anilistId: number
  title: string
  coverUrl: string | null
  genres: string[]
  description: string | null
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
  description: string | null
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
  const [feed, setFeed] = useState<FeedItem[]>([])

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
    fetch('/api/feed')
      .then((r) => r.json())
      .then((j) => setFeed(j.items ?? []))
      .catch(() => { /* feed nélkül is él az oldal */ })
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
        <div className="flex items-start gap-2">
          <TonightPicker />
          <RecommendMorph onAdded={() => { /* a lista frissül a következő betöltéskor */ }} />
        </div>
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

      {feed.length > 0 && (
        <section>
          <p className="label-mono mb-3">Társaság</p>
          <div className="glass rounded-3xl p-4 flex flex-col gap-2.5">
            {feed.slice(0, 12).map((f) => (
              <div key={`${f.kind}-${f.userId}-${f.animeId}-${f.at}`} className="flex items-center gap-3 text-sm">
                <span className="w-7 h-7 shrink-0 rounded-full bg-white/8 grid place-items-center font-mono text-[11px] uppercase text-text-1">
                  {f.username.slice(0, 2)}
                </span>
                <p className="min-w-0 flex-1 text-text-2 truncate">
                  <span className="text-text-1 font-medium">{f.username}</span>{' '}
                  {f.kind === 'added' && <>hozzáadta: </>}
                  {f.kind === 'opinion' && <>véleményt írt: </>}
                  {f.kind === 'episodes' && <>{f.mediaType === 'MANGA' ? 'olvasott' : 'nézett'} ({f.count > 1 ? `${f.count} rész` : f.detail}): </>}
                  {f.kind === 'favchar' && <>kedvence lett: {f.detail} — </>}
                  <Link href={`/anime/preview/${f.anilistId}`} className="text-text-1 hover:underline">{f.title}</Link>
                  {f.kind === 'opinion' && f.detail && <span className="text-text-3"> — „{f.detail}”</span>}
                </p>
                <span className="label-mono shrink-0">{new Date(f.at).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.mine.length > 0 && (
        <section>
          <p className="label-mono mb-3">Amit követsz — következő rész</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {data.mine.map((m, i) => (
              <motion.div
                key={m.animeId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                className="h-full"
              >
                <MediaCard
                  title={m.title}
                  coverUrl={m.coverUrl}
                  genres={m.genres}
                  description={m.description}
                  href={`/anime/${m.animeId}`}
                  badge={
                    <span className="glass rounded-full px-2 py-0.5 font-mono text-[11px] text-text-1">
                      EP {m.nextEpisode} · <Countdown airingAt={m.airingAt} />
                    </span>
                  }
                  footer={
                    <div className="flex items-center justify-between gap-2">
                      <p className="label-mono flex items-center gap-1.5">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${m.status === 'watching' ? 'animate-pulse' : ''}`}
                          style={{ background: STATUS_CSS_VARS[m.status] ?? 'white' }}
                        />
                        {STATUS_LABELS[m.status] ?? m.status}
                        <span className="text-text-3">· {m.progress}{m.episodes ? `/${m.episodes}` : ''}</span>
                      </p>
                      <button
                        onClick={() => bumpProgress(m)}
                        title="Megnéztem egy részt"
                        className="btn-ghost border border-white/10 px-2 py-0.5 text-xs whitespace-nowrap"
                      >
                        +1
                      </button>
                    </div>
                  }
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {data.mine.length > 0 && (
        <section>
          <p className="label-mono mb-3">Heti adásnaptár</p>
          <div className="glass rounded-3xl p-4 grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label, day) => {
              const todayIdx = weekdayIndexBudapest(Math.floor(Date.now() / 1000))
              const items = data.mine.filter((m) => weekdayIndexBudapest(m.airingAt) === day)
              return (
                <div key={label} className={`rounded-xl p-2 min-h-24 ${day === todayIdx ? 'bg-white/8' : 'bg-white/3'}`}>
                  <p className={`label-mono mb-2 text-center ${day === todayIdx ? '!text-text-1' : ''}`}>{label}</p>
                  <div className="flex flex-col items-center gap-1.5">
                    {items.map((m) => (
                      <Link key={m.animeId} href={`/anime/${m.animeId}`} title={m.title}>
                        {m.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.coverUrl} alt={m.title} className="w-9 h-12 object-cover rounded-md hover:scale-110 transition-transform" />
                        ) : (
                          <span className="text-[10px] text-text-2">{m.title.slice(0, 8)}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <p className="label-mono">A szezon</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {data.seasonItems.map((s, i) => (
            <motion.article
              key={s.anilistId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
              className="h-full"
            >
              <MediaCard
                title={s.title}
                coverUrl={s.coverUrl}
                genres={s.genres}
                description={s.description}
                badge={s.tasteScore != null ? (
                  <span
                    className="glass rounded-full px-2 py-0.5 font-mono text-sm font-semibold tabular-nums"
                    title={s.tasteReason ?? undefined}
                    style={{ color: s.tasteScore >= 75 ? 'var(--status-watching)' : 'var(--text-2)' }}
                  >
                    {s.tasteScore}
                  </span>
                ) : undefined}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[12px] text-text-1">
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
                }
              />
            </motion.article>
          ))}
        </div>
      </section>
    </main>
  )
}
