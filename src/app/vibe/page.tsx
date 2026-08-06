'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import MediaCard from '@/components/MediaCard'
import DiscoverTabs from '@/components/DiscoverTabs'
import { VIBE_PRESETS, buildVibePrompt } from '@/lib/vibe-presets'
import type { ApiAnime } from '@/lib/types'

type OwnPick = { animeId: number; title: string; coverUrl: string | null; genres: string[]; status: string; reason: string }
type NewPick = {
  title: string
  reason: string
  anilistId: number | null
  coverUrl: string | null
  year: number | null
  genres: string[]
  description?: string | null
}

export default function VibePage() {
  const [list, setList] = useState<ApiAnime[]>([])
  const [chips, setChips] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQ, setPickerQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ownPicks, setOwnPicks] = useState<OwnPick[]>([])
  const [newPicks, setNewPicks] = useState<NewPick[]>([])
  const [ran, setRan] = useState(false)
  const [addedNew, setAddedNew] = useState<Set<number>>(new Set())
  const t = useTranslations('vibe')
  const tv = useTranslations('vibeChips')
  const tc = useTranslations('common')

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAddedNew((s) => new Set(s).add(anilistId))
  }

  useEffect(() => {
    fetch('/api/anime').then((r) => r.json()).then((j) => setList(j.anime ?? []))
  }, [])

  const pickerRows = useMemo(() => {
    const needle = pickerQ.trim().toLowerCase()
    return list.filter((a) => !needle || a.titleRomaji.toLowerCase().includes(needle))
  }, [list, pickerQ])

  const selectedAnime = list.filter((a) => selected.has(a.id))

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleChip(id: string) {
    setChips((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const prompt = buildVibePrompt([...chips], custom)

  async function run() {
    setLoading(true)
    setError('')
    setOwnPicks([])
    setNewPicks([])
    const res = await fetch('/api/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, chipIds: [...chips], custom, animeIds: [...selected] }),
    })
    const json = await res.json()
    setLoading(false)
    setRan(true)
    if (!res.ok) { setError(json.error ?? tc('error')); return }
    setOwnPicks(json.ownPicks ?? [])
    setNewPicks(json.newPicks ?? [])
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 pt-24 pb-24 md:pb-16 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-sm text-text-2 mt-1">{t('lead')}</p>
        <div className="mt-4"><DiscoverTabs /></div>
      </div>

      <section className="glass rounded-3xl p-5 flex flex-col gap-4">
        {VIBE_PRESETS.map((group) => (
          <div key={group.groupId}>
            <p className="label-mono mb-1.5">{tv(`group_${group.groupId}`)}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.chips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleChip(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    chips.has(c.id)
                      ? 'bg-white/12 border-white/40 text-text-1'
                      : 'border-white/10 text-text-2 hover:text-text-1 hover:border-white/30'
                  }`}
                >
                  {tv(c.id)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={t('customPlaceholder')}
          className="field w-full rounded-full px-4 py-2.5 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {selectedAnime.map((a) => (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className="flex items-center gap-1.5 rounded-full bg-white/8 border border-white/10 pl-1 pr-2.5 py-1 text-xs hover:bg-white/12 transition-colors"
              title={t('remove')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.coverUrl && <img src={a.coverUrl} alt="" className="w-5 h-7 object-cover rounded" />}
              {a.titleRomaji}
              <span className="text-text-3">✕</span>
            </button>
          ))}
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-full border border-dashed border-white/20 px-3 py-1.5 text-xs text-text-2 hover:text-text-1 hover:border-white/40 transition-colors"
          >
            {t('addFromList')}
          </button>
          <button
            onClick={run}
            disabled={loading || (!prompt.trim() && selected.size === 0)}
            className="btn-solid ml-auto px-5 py-2 text-sm"
          >
            {loading ? t('searching') : t('search')}
          </button>
        </div>
      </section>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {newPicks.length > 0 && (
        <section>
          <p className="label-mono mb-2">{t('newDiscovery')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {newPicks.map((p) => (
              <MediaCard
                key={`${p.title}-${p.anilistId ?? 'x'}`}
                title={p.title}
                coverUrl={p.coverUrl}
                genres={p.genres}
                description={p.description}
                href={p.anilistId != null ? `/anime/preview/${p.anilistId}` : undefined}
                footer={
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] text-text-2 leading-snug">{p.reason}</p>
                    {p.anilistId != null ? (
                      <button
                        onClick={() => addToPlanned(p.anilistId!)}
                        disabled={addedNew.has(p.anilistId)}
                        className="btn-ghost border border-white/10 px-2.5 py-1 text-xs whitespace-nowrap self-start disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                      >
                        {addedNew.has(p.anilistId) ? '✓ Tervezem' : '+ Tervezem'}
                      </button>
                    ) : (
                      <a
                        href={`https://anilist.co/search/anime?search=${encodeURIComponent(p.title)}`}
                        target="_blank" rel="noreferrer"
                        className="label-mono hover:text-text-1 whitespace-nowrap self-start"
                      >AniList ↗</a>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {ownPicks.length > 0 && (
        <section>
          <p className="label-mono mb-2">{t('fromYourList')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 opacity-85">
            {ownPicks.map((p) => (
              <MediaCard
                key={p.animeId}
                title={p.title}
                coverUrl={p.coverUrl}
                genres={p.genres}
                href={`/anime/${p.animeId}`}
                footer={<p className="text-[12px] text-text-2 leading-snug">{p.reason}</p>}
              />
            ))}
          </div>
        </section>
      )}

      {ran && !loading && !error && ownPicks.length === 0 && newPicks.length === 0 && (
        <p className="text-sm text-text-3">{t('noResults')}</p>
      )}

      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="glass-strong rounded-3xl w-full max-w-lg max-h-[70vh] flex flex-col p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <input
                  value={pickerQ}
                  onChange={(e) => setPickerQ(e.target.value)}
                  placeholder={t('pickerPlaceholder')}
                  className="field flex-1 rounded-full px-4 py-2 text-sm"
                  autoFocus
                />
                <button onClick={() => setPickerOpen(false)} className="btn-ghost px-3 py-1.5 text-sm">{t('done')}</button>
              </div>
              <div className="overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pickerRows.map((a) => {
                  const isSel = selected.has(a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`relative rounded-xl overflow-hidden border transition-colors text-left ${
                        isSel ? 'border-white/70' : 'border-white/8 hover:border-white/25'
                      }`}
                    >
                      {a.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.coverUrl} alt="" className="w-full aspect-[2/3] object-cover" />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-white/5" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pt-5 pb-1.5 text-[11px] leading-tight">
                        {a.titleRomaji}
                      </span>
                      {isSel && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white text-black text-xs flex items-center justify-center">✓</span>
                      )}
                    </button>
                  )
                })}
                {pickerRows.length === 0 && (
                  <p className="col-span-full text-center text-sm text-text-3 py-6">{t('pickerEmpty')}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
