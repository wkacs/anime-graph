'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import WrappedCard from '@/components/WrappedCard'
import WrappedStory from '@/components/WrappedStory'
import type { WrappedData } from '@/lib/wrapped'
import type { ApiAnime } from '@/lib/types'

type Data = WrappedData & { years: number[] }

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[100dvh] snap-start grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        className="glass rounded-3xl px-8 py-10 max-w-lg w-full text-center"
      >
        {children}
      </motion.div>
    </section>
  )
}

export default function WrappedPage() {
  const [data, setData] = useState<Data | null>(null)
  const [list, setList] = useState<ApiAnime[]>([])
  // null = nincs hiba; '' = van hiba, de a szerver nem adott sajat uzenetet
  const [error, setError] = useState<string | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const t = useTranslations('wrapped')
  const tc = useTranslations('common')

  // Nem `tc(...)`: a forditó nem referencia-stabil, a `load` fuggosegekent
  // minden renderben ujraindulna a lekeres. Az alapertelmezes a renderben lep be.
  async function load(year?: number) {
    const res = await fetch(`/api/wrapped${year ? `?year=${year}` : ''}`)
    if (!res.ok) { setError((await res.json()).error ?? ''); return }
    setData(await res.json())
  }
  useEffect(() => {
    load()
    fetch('/api/anime').then((r) => r.json()).then((j) => setList(j.anime ?? [])).catch(() => {})
  }, [])

  if (error != null) return <main className="min-h-screen grid place-items-center"><p className="text-sm text-[color:var(--status-dropped)]">{error || tc('error')}</p></main>
  if (!data) return <main className="min-h-screen grid place-items-center"><p className="label-mono">{t('generating')}</p></main>

  return (
    <main className="h-[100dvh] overflow-y-auto snap-y snap-mandatory">
      {storyOpen && <WrappedStory data={data} onExit={() => setStoryOpen(false)} />}
      <Slide>
        <p className="label-mono mb-2">Anime Wrapped</p>
        <h1 className="text-5xl font-semibold tabular-nums">{data.year}</h1>
        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          {data.years.map((y) => (
            <button key={y} onClick={() => load(y)}
              className={`btn-ghost px-3 py-1 text-xs border rounded-full ${y === data.year ? 'border-white/40 text-text-1' : 'border-white/10 text-text-3'}`}>
              {y}
            </button>
          ))}
        </div>
        <button onClick={() => setStoryOpen(true)} className="btn-solid px-6 py-2.5 text-sm mt-6">
          {t('startStory')}
        </button>
        <p className="text-text-3 text-sm mt-4">{t('orScroll')}</p>
      </Slide>
      <Slide>
        <p className="label-mono mb-3">{t('watchedThisMuch')}</p>
        <p className="text-5xl font-semibold tabular-nums">{t('hours', { count: Math.round(data.totalHours) })}</p>
        <p className="text-text-2 mt-2">{t('episodesChapters', { count: data.totalEpisodes })}</p>
      </Slide>
      {data.topGenres.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">{t('topGenres')}</p>
          <ol className="flex flex-col gap-2">
            {data.topGenres.map((g, i) => (
              <li key={g.name} className="flex items-baseline justify-between gap-4">
                <span className={i === 0 ? 'text-2xl font-semibold' : 'text-base text-text-2'}>{i + 1}. {g.name}</span>
                <span className="font-mono text-sm text-text-3">{t('titleCount', { count: g.count })}</span>
              </li>
            ))}
          </ol>
        </Slide>
      )}
      {data.topStudios.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">{t('topStudios')}</p>
          <ol className="flex flex-col gap-2">
            {data.topStudios.map((s, i) => (
              <li key={s.name} className="flex items-baseline justify-between gap-4">
                <span className={i === 0 ? 'text-2xl font-semibold' : 'text-base text-text-2'}>{i + 1}. {s.name}</span>
                <span className="font-mono text-sm text-text-3">{t('titleCount', { count: s.count })}</span>
              </li>
            ))}
          </ol>
        </Slide>
      )}
      {data.topAnime.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">{t('titlesOfYear')}</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {data.topAnime.map((t) => (
              <figure key={t.title} className="w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.coverUrl && <img src={t.coverUrl} alt={t.title} className="rounded-xl w-24 h-32 object-cover" />}
                <figcaption className="text-[11px] text-text-2 mt-1 line-clamp-2">{t.title} · {t.myScore}/10</figcaption>
              </figure>
            ))}
          </div>
        </Slide>
      )}
      {data.longestStreakDays > 1 && (
        <Slide>
          <p className="label-mono mb-3">{t('longestStreak')}</p>
          <p className="text-5xl font-semibold tabular-nums">{t('days', { count: data.longestStreakDays })}</p>
          <p className="text-text-2 mt-2">{t('everyDayNonstop')}</p>
        </Slide>
      )}
      {data.maxEpisodesInDay > 1 && (
        <Slide>
          <p className="label-mono mb-3">{t('bingeRecord')}</p>
          <p className="text-5xl font-semibold tabular-nums">{t('episodes', { count: data.maxEpisodesInDay })}</p>
          <p className="text-text-2 mt-2">{t('inOneDay')}</p>
        </Slide>
      )}
      {data.drops > 0 && (
        <Slide>
          <p className="label-mono mb-3">{t('letGo')}</p>
          <p className="text-5xl font-semibold tabular-nums">{t('titleCount', { count: data.drops })}</p>
          <p className="text-text-2 mt-2">{t('thatsFine')}</p>
        </Slide>
      )}
      {data.favChars.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">{t('favChars')}</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {data.favChars.map((c) => (
              <figure key={c.name} className="w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image && <img src={c.image} alt={c.name} className="rounded-full w-16 h-16 object-cover" />}
                <figcaption className="text-[10px] text-text-3 mt-1 truncate">{c.name}</figcaption>
              </figure>
            ))}
          </div>
        </Slide>
      )}
      {data.manga && (
        <Slide>
          <p className="label-mono mb-3">{t('manga')}</p>
          <p className="text-4xl font-semibold tabular-nums">{t('titleCount', { count: data.manga.count })}</p>
          <p className="text-text-2 mt-2">{t('chaptersRead', { count: data.manga.chapters })}</p>
        </Slide>
      )}
      <Slide>
        <p className="label-mono mb-4">{t('share')}</p>
        {list.length > 0 && <WrappedCard list={list} />}
        <div className="mt-6">
          <Link href="/stats" className="btn-ghost border border-white/10 px-4 py-2 text-sm inline-block">{t('backToStats')}</Link>
        </div>
      </Slide>
    </main>
  )
}
