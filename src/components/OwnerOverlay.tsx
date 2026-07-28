'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useStatusLabel } from '@/components/useLabels'
import { STATUS_KEYS, STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime, ApiFact } from '@/lib/types'

const KIND_MARK: Record<string, { glyph: string; cls: string }> = {
  like: { glyph: '▲', cls: 'text-[color:var(--status-watching)]' },
  dislike: { glyph: '▼', cls: 'text-[color:var(--status-dropped)]' },
  note: { glyph: '•', cls: 'text-text-3' },
}

// A hozzaadas-gombok cimkeje NEM azonos a statusz-cimkevel ('Lattam' vs 'Kesz'):
// itt a cselekves szol, nem az allapot.
const ADD_OPTIONS = ['completed', 'watching', 'planned'] as const

type Opinion = { rawText: string; extractStatus: string } | null
type Owned = { anime: ApiAnime; opinion: Opinion; facts: ApiFact[] }

export default function OwnerOverlay({
  titleId, watchlistMeta,
}: {
  titleId: number
  watchlistMeta: { anilistId: number; title: string; coverUrl: string | null; mediaType: string }
}) {
  const [owned, setOwned] = useState<Owned | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [facts, setFacts] = useState<ApiFact[]>([])
  const [opinion, setOpinion] = useState('')
  const [extractStatus, setExtractStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishPrompt, setFinishPrompt] = useState(false)
  const [finishScore, setFinishScore] = useState<number | null>(null)
  const [finishText, setFinishText] = useState('')
  const [sharedAdded, setSharedAdded] = useState(false)
  const [pinnedTitles, setPinnedTitles] = useState<number[] | null>(null)
  const [pinError, setPinError] = useState('')
  const t = useTranslations('owner')
  const statusLabel = useStatusLabel()

  const load = useCallback(async () => {
    const res = await fetch(`/api/anime/owned?titleId=${titleId}`)
    const j = await res.json() as { owned: Owned | null }
    setOwned(j.owned)
    setLoaded(true)
    if (j.owned) {
      setFacts(j.owned.facts)
      if (j.owned.opinion) {
        setOpinion((prev) => prev || j.owned!.opinion!.rawText)
        setExtractStatus(j.owned.opinion.extractStatus)
      }
    }
  }, [titleId])

  useEffect(() => { load() }, [load])

  // kitűzés-állapot (csak listán lévő címnél érdekes)
  useEffect(() => {
    fetch('/api/pins')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { titles: { titleId: number }[] } | null) => {
        if (j) setPinnedTitles(j.titles.map((t) => t.titleId))
      })
      .catch(() => { /* kitűzés nélkül is él az overlay */ })
  }, [])

  async function togglePin() {
    if (pinnedTitles == null) return
    const isPinned = pinnedTitles.includes(titleId)
    const next = isPinned ? pinnedTitles.filter((t) => t !== titleId) : [...pinnedTitles, titleId]
    setPinError('')
    const res = await fetch('/api/pins', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: next }),
    })
    if (res.ok) setPinnedTitles(next)
    else setPinError((await res.json()).error ?? t('pinFailed'))
  }

  const a = owned?.anime ?? null
  const id = a?.id

  async function patch(body: Record<string, unknown>) {
    if (id == null) return
    await fetch(`/api/anime/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    // frissen befejezett anime pont/vélemény nélkül → egy lépéses értékelő
    if (body.status === 'completed' && a && (a.myScore == null || !opinion.trim())) {
      setFinishScore(a.myScore)
      setFinishText(opinion)
      setFinishPrompt(true)
    }
    load()
  }

  async function saveFinish() {
    if (id == null) return
    if (finishScore != null && finishScore !== a?.myScore) {
      await fetch(`/api/anime/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ myScore: finishScore }),
      })
    }
    setFinishPrompt(false)
    if (finishText.trim() && finishText.trim() !== opinion.trim()) {
      setOpinion(finishText)
      setSaving(true)
      const res = await fetch('/api/opinion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animeId: id, rawText: finishText }),
      })
      const json = await res.json()
      setExtractStatus(json.extractStatus)
      setSaving(false)
    }
    load()
  }

  async function saveOpinion(retry = false) {
    if (id == null) return
    setSaving(true)
    const res = await fetch('/api/opinion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retry ? { animeId: id, retry: true } : { animeId: id, rawText: opinion }),
    })
    const json = await res.json()
    setExtractStatus(json.extractStatus)
    setSaving(false)
    load()
  }

  async function deleteFact(factId: number) {
    await fetch(`/api/taste/${factId}`, { method: 'DELETE' })
    load()
  }

  async function remove() {
    if (id == null || !a || !confirm(t('confirmRemove', { title: a.titleRomaji }))) return
    await fetch(`/api/anime/${id}`, { method: 'DELETE' })
    // marad az oldalon; az overlay újratölt → megjelenik a hozzáadás-CTA
    setOwned(null); setFacts([]); setOpinion(''); setExtractStatus(null)
  }

  async function addToList(status: string) {
    const res = await fetch('/api/anime', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titleId, status }),
    })
    // publikus katalógus-oldalon anonim látogató: a lista-műveletek loginhoz kötöttek
    if (res.status === 401) { window.location.href = '/login'; return }
    if (res.ok) load()
  }

  if (!loaded) return null // progressive enhancement — no flash while checking ownership

  if (!owned || !a) {
    return (
      <section className="glass rounded-3xl p-5 flex flex-wrap items-center gap-2">
        <span className="label-mono mr-1">{t('notOnYourList')}</span>
        {ADD_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => addToList(s)}
            className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors"
          >
            {t(`add_${s}`)}
          </button>
        ))}
        <button
          onClick={async () => {
            const res = await fetch('/api/watchlist', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ anilistId: watchlistMeta.anilistId, title: watchlistMeta.title, coverUrl: watchlistMeta.coverUrl, mediaType: watchlistMeta.mediaType }),
            })
            if (res.status === 401) { window.location.href = '/login'; return }
            if (res.ok) setSharedAdded(true)
          }}
          disabled={sharedAdded}
          className="btn-ghost border border-white/10 px-3 py-1.5 text-xs disabled:text-[color:var(--status-watching)] disabled:border-transparent"
        >
          {sharedAdded ? t('inShared') : t('toShared')}
        </button>
      </section>
    )
  }

  return (
    <>
      {/* status line */}
      <p className="label-mono flex items-center gap-2 -mb-1">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: STATUS_CSS_VARS[a.status] ?? 'white' }} />
        {statusLabel(a.status)}
        {a.rewatchCount > 0 && <span className="text-text-3">· ↻ ×{a.rewatchCount}</span>}
      </p>

      {/* controls */}
      <section className="glass rounded-3xl p-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-2">
          {t('statusLabel')}
          <select value={a.status} onChange={(e) => patch({ status: e.target.value })} className="field px-3 py-1.5 text-sm">
            {STATUS_KEYS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-2">
          {a.mediaType === 'MANGA' ? t('chapter') : t('episode')}
          <input
            type="number" min={0} value={a.progress}
            onChange={(e) => patch({ progress: Number(e.target.value) })}
            className="field w-20 px-3 py-1.5 text-sm"
          />
          <span className="text-text-3">/ {(a.mediaType === 'MANGA' ? a.chapters : a.episodes) ?? '?'}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-2">
          {t('myScore')}
          <input
            type="number" min={1} max={10} value={a.myScore ?? ''} placeholder="–"
            onChange={(e) => patch({ myScore: e.target.value === '' ? null : Number(e.target.value) })}
            className="field w-16 px-3 py-1.5 text-sm"
          />
          <span className="text-text-3">/ 10</span>
        </label>
        {pinnedTitles != null && (
          <button
            onClick={togglePin}
            title={pinnedTitles.includes(titleId) ? t('unpinTooltip') : t('pinTooltip')}
            className={`btn-ghost border px-3.5 py-1.5 text-sm ${
              pinnedTitles.includes(titleId) ? 'border-white/35 text-text-1' : 'border-white/10'
            }`}
          >
            {pinnedTitles.includes(titleId) ? t('pinned') : t('pin')}
          </button>
        )}
        {pinError && <span className="text-xs text-[color:var(--status-dropped)]">{pinError}</span>}
        {a.status === 'completed' && (
          <button
            onClick={() => { if (confirm(t('confirmRewatch'))) patch({ rewatch: true }) }}
            className="btn-ghost border border-white/10 px-3.5 py-1.5 text-sm ml-auto"
          >
            {t('startRewatch')}
          </button>
        )}
        <button
          onClick={async () => {
            const res = await fetch('/api/watchlist', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ anilistId: a.anilistId, title: a.titleRomaji, coverUrl: a.coverUrl, mediaType: a.mediaType }),
            })
            if (res.ok) setSharedAdded(true)
          }}
          disabled={sharedAdded}
          title={t('toSharedTooltip')}
          className="btn-ghost border border-white/10 px-3.5 py-1.5 text-sm disabled:text-[color:var(--status-watching)] disabled:border-transparent"
        >
          {sharedAdded ? t('inShared') : t('toShared')}
        </button>
      </section>

      {/* opinion */}
      <section data-tour="opinion" className="glass rounded-3xl p-5">
        <p className="label-mono mb-3">{t('myReview')}</p>
        <textarea
          value={opinion}
          onChange={(e) => setOpinion(e.target.value)}
          rows={6}
          placeholder={t('reviewPlaceholder')}
          className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
        />
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => saveOpinion()} disabled={saving || !opinion.trim()} className="btn-solid px-5 py-2 text-sm">
            {saving ? t('saving') : t('saveWithExtract')}
          </button>
          {extractStatus === 'failed' && (
            <button onClick={() => saveOpinion(true)} className="text-sm text-text-2 hover:text-text-1 underline underline-offset-4">
              {t('retryExtract')}
            </button>
          )}
          {extractStatus === 'done' && <span className="label-mono text-[color:var(--status-watching)]">{t('extracted')}</span>}
        </div>
        {facts.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-5">
            {facts.map((f) => {
              const mark = KIND_MARK[f.kind] ?? KIND_MARK.note
              return (
                <li key={f.id} className="flex items-start gap-2.5 rounded-xl bg-white/4 border border-white/5 px-3 py-2 text-sm">
                  <span className={`${mark.cls} text-[10px] mt-1`}>{mark.glyph}</span>
                  <span className="flex-1 text-text-1">{f.text}</span>
                  <button onClick={() => deleteFact(f.id)} className="text-text-3 hover:text-[color:var(--status-dropped)]">✕</button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <button onClick={remove} className="self-start text-sm text-text-3 hover:text-[color:var(--status-dropped)] transition-colors">
        {t('removeFromList')}
      </button>

      {/* frissen befejezve → pont + vélemény egy lépésben */}
      {finishPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setFinishPrompt(false)}>
          <div className="glass-strong rounded-3xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <p className="label-mono mb-1">{t('finishedKicker')}</p>
            <h2 className="text-lg font-semibold tracking-tight mb-4">{t('howWasIt')}</h2>
            <div className="flex gap-1 mb-4">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setFinishScore(n)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-mono transition-colors ${
                    finishScore === n ? 'bg-white text-black font-semibold' : 'bg-white/6 text-text-2 hover:bg-white/12'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              value={finishText}
              onChange={(e) => setFinishText(e.target.value)}
              rows={4}
              placeholder={t('finishPlaceholder')}
              className="field w-full rounded-2xl p-3 text-sm leading-relaxed mb-4"
            />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setFinishPrompt(false)} className="btn-ghost px-4 py-2 text-sm">{t('skip')}</button>
              <button onClick={saveFinish} className="btn-solid px-5 py-2 text-sm">{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
