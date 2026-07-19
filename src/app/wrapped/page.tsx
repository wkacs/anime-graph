'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import WrappedCard from '@/components/WrappedCard'
import type { WrappedData } from '@/lib/wrapped'
import type { ApiAnime } from '@/lib/types'

type Data = WrappedData & { years: number[] }

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-screen snap-start grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
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
  const [error, setError] = useState('')

  async function load(year?: number) {
    const res = await fetch(`/api/wrapped${year ? `?year=${year}` : ''}`)
    if (!res.ok) { setError((await res.json()).error ?? 'Hiba történt'); return }
    setData(await res.json())
  }
  useEffect(() => {
    load()
    fetch('/api/anime').then((r) => r.json()).then((j) => setList(j.anime ?? [])).catch(() => {})
  }, [])

  if (error) return <main className="min-h-screen grid place-items-center"><p className="text-sm text-[color:var(--status-dropped)]">{error}</p></main>
  if (!data) return <main className="min-h-screen grid place-items-center"><p className="label-mono">Összefoglaló készül…</p></main>

  return (
    <main className="h-screen overflow-y-auto snap-y snap-mandatory">
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
        <p className="text-text-3 text-sm mt-6">Görgess ↓</p>
      </Slide>
      <Slide>
        <p className="label-mono mb-3">Ennyit néztél</p>
        <p className="text-5xl font-semibold tabular-nums">{Math.round(data.totalHours)} óra</p>
        <p className="text-text-2 mt-2">{data.totalEpisodes} rész / fejezet</p>
      </Slide>
      {data.topGenres.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Top műfajaid</p>
          <ol className="flex flex-col gap-2">
            {data.topGenres.map((g, i) => (
              <li key={g.name} className="flex items-baseline justify-between gap-4">
                <span className={i === 0 ? 'text-2xl font-semibold' : 'text-base text-text-2'}>{i + 1}. {g.name}</span>
                <span className="font-mono text-sm text-text-3">{g.count} cím</span>
              </li>
            ))}
          </ol>
        </Slide>
      )}
      {data.topStudios.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Top stúdióid</p>
          <ol className="flex flex-col gap-2">
            {data.topStudios.map((s, i) => (
              <li key={s.name} className="flex items-baseline justify-between gap-4">
                <span className={i === 0 ? 'text-2xl font-semibold' : 'text-base text-text-2'}>{i + 1}. {s.name}</span>
                <span className="font-mono text-sm text-text-3">{s.count} cím</span>
              </li>
            ))}
          </ol>
        </Slide>
      )}
      {data.topAnime.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Az év címei nálad</p>
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
          <p className="label-mono mb-3">Leghosszabb sorozatod</p>
          <p className="text-5xl font-semibold tabular-nums">{data.longestStreakDays} nap</p>
          <p className="text-text-2 mt-2">megállás nélkül minden nap</p>
        </Slide>
      )}
      {data.favChars.length > 0 && (
        <Slide>
          <p className="label-mono mb-4">Idei kedvenc karaktereid</p>
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
          <p className="label-mono mb-3">Manga</p>
          <p className="text-4xl font-semibold tabular-nums">{data.manga.count} cím</p>
          <p className="text-text-2 mt-2">{data.manga.chapters} fejezet elolvasva</p>
        </Slide>
      )}
      <Slide>
        <p className="label-mono mb-4">Oszd meg</p>
        {list.length > 0 && <WrappedCard list={list} />}
        <div className="mt-6">
          <Link href="/stats" className="btn-ghost border border-white/10 px-4 py-2 text-sm inline-block">← Vissza a Stats-ra</Link>
        </div>
      </Slide>
    </main>
  )
}
