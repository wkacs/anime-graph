'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import type { WrappedData } from '@/lib/wrapped'

// A dia irányfüggően jön-megy: előre lépve jobbról érkezik és balra távozik,
// visszafelé fordítva (§7 be- és kilépés egy úton, §8 az irány elárulja a
// következő állapotot). bounce 0: itt semmilyen gesztus nem visz lendületet.
const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
}

// Teljes képernyős story-mód: progress-sáv felül, kattintás/tap (jobb 2/3 = tovább,
// bal 1/3 = vissza) + nyílbillentyűk. Az utolsó slide után onExit.
export default function WrappedStory({ data, onExit }: { data: WrappedData; onExit: () => void }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const t = useTranslations('wrapped')

  const slides = useMemo(() => {
    const s: React.ReactNode[] = []
    s.push(
      <div key="intro">
        <p className="label-mono mb-3">Anime Wrapped</p>
        <h1 className="text-6xl font-semibold tracking-[-0.03em] tabular-nums">{data.year}</h1>
        <p className="text-text-2 mt-4">{t('yourYear')}</p>
      </div>,
    )
    s.push(
      <div key="hours">
        <p className="label-mono mb-3">{t('watchedThisMuch')}</p>
        <p className="text-6xl font-semibold tracking-[-0.03em] tabular-nums">{t('hours', { count: Math.round(data.totalHours) })}</p>
        <p className="text-text-2 mt-3">{t('episodesChapters', { count: data.totalEpisodes })}</p>
      </div>,
    )
    if (data.topGenres.length > 0) s.push(
      <div key="genres">
        <p className="label-mono mb-5">{t('topGenres')}</p>
        <ol className="flex flex-col gap-2.5">
          {data.topGenres.map((g, idx) => (
            <li key={g.name} className="flex items-baseline justify-between gap-6">
              <span className={idx === 0 ? 'text-3xl font-semibold' : 'text-lg text-text-2'}>{idx + 1}. {g.name}</span>
              <span className="font-mono text-sm text-text-3">{t('titleCount', { count: g.count })}</span>
            </li>
          ))}
        </ol>
      </div>,
    )
    if (data.topStudios.length > 0) s.push(
      <div key="studios">
        <p className="label-mono mb-5">{t('topStudios')}</p>
        <ol className="flex flex-col gap-2.5">
          {data.topStudios.map((st, idx) => (
            <li key={st.name} className="flex items-baseline justify-between gap-6">
              <span className={idx === 0 ? 'text-3xl font-semibold' : 'text-lg text-text-2'}>{idx + 1}. {st.name}</span>
              <span className="font-mono text-sm text-text-3">{t('titleCount', { count: st.count })}</span>
            </li>
          ))}
        </ol>
      </div>,
    )
    if (data.topAnime.length > 0) s.push(
      <div key="top">
        <p className="label-mono mb-5">{t('titlesOfYear')}</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {data.topAnime.map((t) => (
            <figure key={t.title} className="w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.coverUrl && <img src={t.coverUrl} alt={t.title} className="rounded-xl w-24 h-32 object-cover border border-white/10" />}
              <figcaption className="text-11 text-micro text-text-2 mt-1.5 line-clamp-2">{t.title} · {t.myScore}/10</figcaption>
            </figure>
          ))}
        </div>
      </div>,
    )
    if (data.longestStreakDays > 1) s.push(
      <div key="streak">
        <p className="label-mono mb-3">{t('longestStreak')}</p>
        <p className="text-6xl font-semibold tracking-[-0.03em] tabular-nums">{t('days', { count: data.longestStreakDays })}</p>
        <p className="text-text-2 mt-3">{t('everyDayNonstop')}</p>
      </div>,
    )
    if (data.maxEpisodesInDay > 1) s.push(
      <div key="binge">
        <p className="label-mono mb-3">{t('bingeRecord')}</p>
        <p className="text-6xl font-semibold tracking-[-0.03em] tabular-nums">{t('episodes', { count: data.maxEpisodesInDay })}</p>
        <p className="text-text-2 mt-3">{t('inOneDay')}</p>
      </div>,
    )
    if (data.favChars.length > 0) s.push(
      <div key="chars">
        <p className="label-mono mb-5">{t('favChars')}</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {data.favChars.map((c) => (
            <figure key={c.name} className="w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image && <img src={c.image} alt={c.name} className="rounded-full w-16 h-16 object-cover border border-white/10" />}
              <figcaption className="text-xxs text-micro-xs text-text-3 mt-1 truncate">{c.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>,
    )
    if (data.drops > 0) s.push(
      <div key="drops">
        <p className="label-mono mb-3">{t('letGo')}</p>
        <p className="text-6xl font-semibold tracking-[-0.03em] tabular-nums">{t('titleCount', { count: data.drops })}</p>
        <p className="text-text-2 mt-3">{t('thatsFine')}</p>
      </div>,
    )
    if (data.manga) s.push(
      <div key="manga">
        <p className="label-mono mb-3">{t('manga')}</p>
        <p className="text-5xl font-semibold tracking-[-0.025em] tabular-nums">{t('titleCount', { count: data.manga.count })}</p>
        <p className="text-text-2 mt-3">{t('chaptersRead', { count: data.manga.chapters })}</p>
      </div>,
    )
    s.push(
      <div key="outro">
        <p className="label-mono mb-4">{t('summaryOf', { year: data.year })}</p>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{Math.round(data.totalHours)}</p>
            <p className="label-mono !text-2xs">{t('unitHours')}</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{data.totalEpisodes}</p>
            <p className="label-mono !text-2xs">{t('unitEpisodes')}</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{data.longestStreakDays}</p>
            <p className="label-mono !text-2xs">{t('unitStreak')}</p>
          </div>
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-2xl font-semibold truncate">{data.topGenres[0]?.name ?? '–'}</p>
            <p className="label-mono !text-2xs">{t('unitTopGenre')}</p>
          </div>
        </div>
        <p className="text-text-3 text-sm mt-6">{t('clickToClose')}</p>
      </div>,
    )
    return s
  }, [data, t])

  const step = (dir: 1 | -1) => {
    // az irány eltárolása: enélkül a dia mindig ugyanonnan úszott be, tehát
    // a mozgás nem árulta el, előre vagy hátra léptünk (§8)
    setDir(dir)
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
            {/* scaleX, nem width: a width layoutot indít minden képkockán,
                a transform a compositoron fut (§11). A hármas ternária is
                összeesik — a két „w-full" ág ugyanaz volt. */}
            <span
              className="block h-full w-full origin-left bg-white/85 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: idx <= i ? 'scaleX(1)' : 'scaleX(0)' }}
            />
          </span>
        ))}
      </div>
      <button
        onClick={onExit}
        aria-label={t('close')}
        className="absolute top-8 right-4 z-20 w-9 h-9 rounded-full glass flex items-center justify-center text-text-2 hover:text-text-1"
      >
        ✕
      </button>
      {/* kattintás-zónák: bal 1/3 vissza, jobb 2/3 tovább.
          active:bg-white/5 — teljes képernyős story-módban ez az EGYETLEN
          nyugtázás, hogy a koppintás megérkezett (§1/§10) */}
      <button aria-label={t('previous')} onClick={() => step(-1)} className="absolute inset-y-0 left-0 w-1/3 z-[5] cursor-w-resize active:bg-white/5 transition-colors duration-100" />
      <button aria-label={t('next')} onClick={() => step(1)} className="absolute inset-y-0 right-0 w-2/3 z-[5] cursor-e-resize active:bg-white/5 transition-colors duration-100" />
      <div className="h-full grid place-items-center px-6">
        {/* CSS-@keyframes helyett framer: a kulcskocka minden lépésnél
            0-ról indult újra, tehát gyors koppintásoknál a tartalom
            kivillant — a spring az ÉLŐ értékről céloz újra (§3). */}
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={i}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="max-w-lg w-full text-center"
          >
            {slides[i]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
