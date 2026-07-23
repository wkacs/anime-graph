'use client'
import { useCallback, useEffect, useState } from 'react'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime, ApiFact } from '@/lib/types'

const STATUS_OPTIONS = ['watching', 'completed', 'planned', 'dropped'] as const

const KIND_MARK: Record<string, { glyph: string; cls: string }> = {
  like: { glyph: '▲', cls: 'text-[color:var(--status-watching)]' },
  dislike: { glyph: '▼', cls: 'text-[color:var(--status-dropped)]' },
  note: { glyph: '•', cls: 'text-text-3' },
}

const ADD_OPTIONS = [
  { status: 'completed', label: 'Láttam' },
  { status: 'watching', label: 'Nézem' },
  { status: 'planned', label: 'Tervezem' },
] as const

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
    if (id == null || !a || !confirm(`Törlöd a listádról: ${a.titleRomaji}?`)) return
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
        <span className="label-mono mr-1">Nincs a listádon</span>
        {ADD_OPTIONS.map((o) => (
          <button
            key={o.status}
            onClick={() => addToList(o.status)}
            className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-mono uppercase tracking-wide text-text-2 hover:text-text-1 hover:border-white/35 transition-colors"
          >
            {o.label}
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
          {sharedAdded ? '✓ Közösben' : '+ Közösbe'}
        </button>
      </section>
    )
  }

  return (
    <>
      {/* status line */}
      <p className="label-mono flex items-center gap-2 -mb-1">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: STATUS_CSS_VARS[a.status] ?? 'white' }} />
        {STATUS_LABELS[a.status] ?? a.status}
        {a.rewatchCount > 0 && <span className="text-text-3">· ↻ ×{a.rewatchCount}</span>}
      </p>

      {/* controls */}
      <section className="glass rounded-3xl p-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-2">
          Státusz
          <select value={a.status} onChange={(e) => patch({ status: e.target.value })} className="field px-3 py-1.5 text-sm">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-2">
          {a.mediaType === 'MANGA' ? 'Fejezet' : 'Rész'}
          <input
            type="number" min={0} value={a.progress}
            onChange={(e) => patch({ progress: Number(e.target.value) })}
            className="field w-20 px-3 py-1.5 text-sm"
          />
          <span className="text-text-3">/ {(a.mediaType === 'MANGA' ? a.chapters : a.episodes) ?? '?'}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-2">
          Pontom
          <input
            type="number" min={1} max={10} value={a.myScore ?? ''} placeholder="–"
            onChange={(e) => patch({ myScore: e.target.value === '' ? null : Number(e.target.value) })}
            className="field w-16 px-3 py-1.5 text-sm"
          />
          <span className="text-text-3">/ 10</span>
        </label>
        {a.status === 'completed' && (
          <button
            onClick={() => { if (confirm('Újranézed? A progressz nullázódik, a számláló nő.')) patch({ rewatch: true }) }}
            className="btn-ghost border border-white/10 px-3.5 py-1.5 text-sm ml-auto"
          >
            ↻ Újranézés indítása
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
          title="Fel a közös „együtt nézzük” listára"
          className="btn-ghost border border-white/10 px-3.5 py-1.5 text-sm disabled:text-[color:var(--status-watching)] disabled:border-transparent"
        >
          {sharedAdded ? '✓ Közösben' : '+ Közösbe'}
        </button>
      </section>

      {/* opinion */}
      <section className="glass rounded-3xl p-5">
        <p className="label-mono mb-3">Véleményem</p>
        <textarea
          value={opinion}
          onChange={(e) => setOpinion(e.target.value)}
          rows={6}
          placeholder="Mi tetszett? Mi nem? Írd le szabadon — az AI kinyeri belőle az ízlés-tényeket."
          className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
        />
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => saveOpinion()} disabled={saving || !opinion.trim()} className="btn-solid px-5 py-2 text-sm">
            {saving ? 'Mentés…' : 'Mentés + AI-kivonat'}
          </button>
          {extractStatus === 'failed' && (
            <button onClick={() => saveOpinion(true)} className="text-sm text-text-2 hover:text-text-1 underline underline-offset-4">
              Kivonat újra ↻
            </button>
          )}
          {extractStatus === 'done' && <span className="label-mono text-[color:var(--status-watching)]">✓ kivonatolva</span>}
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
        Anime törlése a listából
      </button>

      {/* frissen befejezve → pont + vélemény egy lépésben */}
      {finishPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setFinishPrompt(false)}>
          <div className="glass-strong rounded-3xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <p className="label-mono mb-1">Befejezted 🎉</p>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Milyen volt?</h2>
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
              placeholder="Pár mondat: mi tetszett, mi nem — ebből tanul az ajánló."
              className="field w-full rounded-2xl p-3 text-sm leading-relaxed mb-4"
            />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setFinishPrompt(false)} className="btn-ghost px-4 py-2 text-sm">Kihagyom</button>
              <button onClick={saveFinish} className="btn-solid px-5 py-2 text-sm">Mentés</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
