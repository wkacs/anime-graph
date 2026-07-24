'use client'
import { useEffect, useMemo, useState } from 'react'
import type { WrappedData } from '@/lib/wrapped'

// Teljes képernyős story-mód: progress-sáv felül, kattintás/tap (jobb 2/3 = tovább,
// bal 1/3 = vissza) + nyílbillentyűk. Az utolsó slide után onExit.
export default function WrappedStory({ data, onExit }: { data: WrappedData; onExit: () => void }) {
  const [i, setI] = useState(0)

  const slides = useMemo(() => {
    const s: React.ReactNode[] = []
    s.push(
      <div key="intro">
        <p className="label-mono mb-3">Anime Wrapped</p>
        <h1 className="text-6xl font-semibold tabular-nums">{data.year}</h1>
        <p className="text-text-2 mt-4">Így nézett ki az éved.</p>
      </div>,
    )
    s.push(
      <div key="hours">
        <p className="label-mono mb-3">Ennyit néztél</p>
        <p className="text-6xl font-semibold tabular-nums">{Math.round(data.totalHours)} óra</p>
        <p className="text-text-2 mt-3">{data.totalEpisodes} rész / fejezet</p>
      </div>,
    )
    if (data.topGenres.length > 0) s.push(
      <div key="genres">
        <p className="label-mono mb-5">Top műfajaid</p>
        <ol className="flex flex-col gap-2.5">
          {data.topGenres.map((g, idx) => (
            <li key={g.name} className="flex items-baseline justify-between gap-6">
              <span className={idx === 0 ? 'text-3xl font-semibold' : 'text-lg text-text-2'}>{idx + 1}. {g.name}</span>
              <span className="font-mono text-sm text-text-3">{g.count} cím</span>
            </li>
          ))}
        </ol>
      </div>,
    )
    if (data.topStudios.length > 0) s.push(
      <div key="studios">
        <p className="label-mono mb-5">Top stúdióid</p>
        <ol className="flex flex-col gap-2.5">
          {data.topStudios.map((st, idx) => (
            <li key={st.name} className="flex items-baseline justify-between gap-6">
              <span className={idx === 0 ? 'text-3xl font-semibold' : 'text-lg text-text-2'}>{idx + 1}. {st.name}</span>
              <span className="font-mono text-sm text-text-3">{st.count} cím</span>
            </li>
          ))}
        </ol>
      </div>,
    )
    if (data.topAnime.length > 0) s.push(
      <div key="top">
        <p className="label-mono mb-5">Az év címei nálad</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {data.topAnime.map((t) => (
            <figure key={t.title} className="w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.coverUrl && <img src={t.coverUrl} alt={t.title} className="rounded-xl w-24 h-32 object-cover border border-white/10" />}
              <figcaption className="text-[11px] text-text-2 mt-1.5 line-clamp-2">{t.title} · {t.myScore}/10</figcaption>
            </figure>
          ))}
        </div>
      </div>,
    )
    if (data.longestStreakDays > 1) s.push(
      <div key="streak">
        <p className="label-mono mb-3">Leghosszabb sorozatod</p>
        <p className="text-6xl font-semibold tabular-nums">{data.longestStreakDays} nap</p>
        <p className="text-text-2 mt-3">megállás nélkül minden nap</p>
      </div>,
    )
    if (data.maxEpisodesInDay > 1) s.push(
      <div key="binge">
        <p className="label-mono mb-3">Binge-rekordod</p>
        <p className="text-6xl font-semibold tabular-nums">{data.maxEpisodesInDay} rész</p>
        <p className="text-text-2 mt-3">egyetlen nap alatt</p>
      </div>,
    )
    if (data.favChars.length > 0) s.push(
      <div key="chars">
        <p className="label-mono mb-5">Idei kedvenc karaktereid</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {data.favChars.map((c) => (
            <figure key={c.name} className="w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image && <img src={c.image} alt={c.name} className="rounded-full w-16 h-16 object-cover border border-white/10" />}
              <figcaption className="text-[10px] text-text-3 mt-1 truncate">{c.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>,
    )
    if (data.drops > 0) s.push(
      <div key="drops">
        <p className="label-mono mb-3">Elengedted</p>
        <p className="text-6xl font-semibold tabular-nums">{data.drops} cím</p>
        <p className="text-text-2 mt-3">és ez teljesen rendben van</p>
      </div>,
    )
    if (data.manga) s.push(
      <div key="manga">
        <p className="label-mono mb-3">Manga</p>
        <p className="text-5xl font-semibold tabular-nums">{data.manga.count} cím</p>
        <p className="text-text-2 mt-3">{data.manga.chapters} fejezet elolvasva</p>
      </div>,
    )
    s.push(
      <div key="outro">
        <p className="label-mono mb-4">{data.year} összefoglalva</p>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{Math.round(data.totalHours)}</p>
            <p className="label-mono !text-[9px]">óra</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{data.totalEpisodes}</p>
            <p className="label-mono !text-[9px]">rész / fejezet</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{data.longestStreakDays}</p>
            <p className="label-mono !text-[9px]">napos streak</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold truncate">{data.topGenres[0]?.name ?? '–'}</p>
            <p className="label-mono !text-[9px]">top műfaj</p>
          </div>
        </div>
        <p className="text-text-3 text-sm mt-6">Kattints a bezáráshoz</p>
      </div>,
    )
    return s
  }, [data])

  const step = (dir: 1 | -1) => {
    setI((cur) => {
      const next = cur + dir
      if (next >= slides.length) { onExit(); return cur }
      return Math.max(0, next)
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length])

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b]">
      {/* progress-szegmensek */}
      <div className="absolute top-4 inset-x-4 z-10 flex gap-1.5">
        {slides.map((_, idx) => (
          <span key={idx} className="flex-1 h-1 rounded-full overflow-hidden bg-white/15">
            <span className={`block h-full bg-white/85 transition-[width] duration-300 ${idx < i ? 'w-full' : idx === i ? 'w-full' : 'w-0'}`} />
          </span>
        ))}
      </div>
      <button
        onClick={onExit}
        aria-label="Bezárás"
        className="absolute top-8 right-4 z-20 w-9 h-9 rounded-full glass flex items-center justify-center text-text-2 hover:text-text-1"
      >
        ✕
      </button>
      {/* kattintás-zónák: bal 1/3 vissza, jobb 2/3 tovább */}
      <button aria-label="Előző" onClick={() => step(-1)} className="absolute inset-y-0 left-0 w-1/3 z-[5] cursor-w-resize" />
      <button aria-label="Következő" onClick={() => step(1)} className="absolute inset-y-0 right-0 w-2/3 z-[5] cursor-e-resize" />
      <div className="h-full grid place-items-center px-6">
        <div key={i} className="max-w-lg w-full text-center animate-[fadeUp_.5s_ease]">
          {slides[i]}
        </div>
      </div>
    </div>
  )
}
