'use client'
import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import Dialog from '@/components/ui/Dialog'
import { tweenFluid } from '@/lib/motion'
import { pickTonight, type TonightMood, type TonightPick, type TonightAnime } from '@/lib/tonight'

const MOODS = ['barmi', 'folytatas', 'rovid', 'comfort'] as const satisfies readonly TonightMood[]

export default function TonightPicker() {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TonightAnime[]>([])
  const [pick, setPick] = useState<TonightPick | null>(null)
  const [mood, setMood] = useState<TonightMood>('barmi')
  const t = useTranslations('tonight')
  const headingId = useId()

  useEffect(() => {
    if (!open || rows.length) return
    fetch('/api/anime').then((r) => r.json()).then((j) =>
      setRows(((j.anime ?? []) as (TonightAnime & { mediaType?: string })[])
        .filter((a) => a.mediaType !== 'MANGA')))
  }, [open, rows.length])

  function roll(m: TonightMood) {
    setMood(m)
    setPick(pickTonight(rows, m))
  }

  async function startWatching() {
    if (!pick) return
    await fetch(`/api/anime/${pick.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'watching' }),
    })
    setOpen(false)
    setPick(null)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass rounded-full px-4 py-2 text-sm text-text-2 hover:text-text-1 hover:bg-white/8 transition-colors"
      >
        {t('cta')}
      </button>
      {/* A közös Dialog: ugyanaz a mozgás, plusz role/aria, fókusz-csapda,
          Escape és görgetés-zár, ami eddig egyik modálon sem volt. */}
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={headingId}>
            <>
              <p className="label-mono mb-1">{t('kicker')}</p>
              {/* tracking-tight törölve: 18px-en a §15 szerint 0 a helyes */}
              <h2 id={headingId} className="text-lg font-semibold mb-4">{t('question')}</h2>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => roll(m)}
                    className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                      pick && mood === m
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/6 text-text-2 hover:bg-white/12'
                    }`}
                  >
                    {t(`mood_${m}`)}
                  </button>
                ))}
              </div>

              {pick ? (
                <motion.div
                  key={pick.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  // transition NÉLKÜL a lib alapértelmezett, enyhén pattogó
                  // springjére esett vissza — itt semmilyen gesztus nem vitt
                  // lendületet, tehát a túllövés indokolatlan (§4)
                  transition={tweenFluid}
                  className="flex gap-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {pick.coverUrl && <img src={pick.coverUrl} alt="" className="w-24 rounded-xl self-start" />}
                  <div className="min-w-0 flex flex-col">
                    <Link href={`/anime/${pick.id}`} className="text-base font-semibold leading-tight hover:underline underline-offset-4 decoration-white/30">
                      {pick.titleRomaji}
                    </Link>
                    <p className="label-mono mt-1">
                      {pick.episodes != null ? t('episodeCount', { count: pick.episodes }) : pick.format ?? ''}
                    </p>
                    <p className="text-13 text-text-2 leading-snug mt-2">
                      {/* A picker kulcsot ad, nem mondatot — lasd lib/tonight.ts */}
                      {t(`reason_${pick.reason.key}`, { ...pick.reason })}
                    </p>
                    <div className="flex gap-2 mt-auto pt-3">
                      <button onClick={startWatching} className="btn-solid px-4 py-1.5 text-xs">
                        {t('watchThis')}
                      </button>
                      <button onClick={() => roll(mood)} className="btn-ghost border border-white/10 px-3 py-1.5 text-xs">
                        {t('another')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p className="text-sm text-text-3">{t('hint')}</p>
              )}
            </>
      </Dialog>
    </>
  )
}
