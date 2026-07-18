'use client'
import { useEffect, useState } from 'react'
import type { ApiAnime, ApiFact } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: 'watching', label: 'Nézem' },
  { value: 'completed', label: 'Kész' },
  { value: 'planned', label: 'Tervezem' },
  { value: 'dropped', label: 'Dropped' },
]

const KIND_BADGE: Record<string, string> = {
  like: 'text-emerald-400',
  dislike: 'text-red-400',
  note: 'text-slate-400',
}

export default function SidePanel({
  anime, facts, onClose, onChanged,
}: {
  anime: ApiAnime
  facts: ApiFact[]
  onClose: () => void
  onChanged: () => void
}) {
  const [opinion, setOpinion] = useState('')
  const [extractStatus, setExtractStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOpinion('')
    setExtractStatus(null)
    fetch(`/api/opinion?animeId=${anime.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.opinion) { setOpinion(j.opinion.rawText); setExtractStatus(j.opinion.extractStatus) }
      })
  }, [anime.id])

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/anime/${anime.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    onChanged()
  }

  async function saveOpinion(retry = false) {
    setSaving(true)
    const res = await fetch('/api/opinion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retry ? { animeId: anime.id, retry: true } : { animeId: anime.id, rawText: opinion }),
    })
    const json = await res.json()
    setExtractStatus(json.extractStatus)
    setSaving(false)
    onChanged()
  }

  async function deleteFact(id: number) {
    await fetch(`/api/taste/${id}`, { method: 'DELETE' })
    onChanged()
  }

  async function remove() {
    if (!confirm(`Törlöd: ${anime.titleRomaji}?`)) return
    await fetch(`/api/anime/${anime.id}`, { method: 'DELETE' })
    onClose()
    onChanged()
  }

  const myFacts = facts.filter((f) => f.animeId === anime.id)

  return (
    <aside className="absolute top-0 right-0 z-10 h-screen w-96 overflow-y-auto bg-slate-950/95 border-l border-slate-700 text-slate-200 text-sm backdrop-blur">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {anime.coverUrl && <img src={anime.coverUrl} alt="" className="w-20 rounded-lg" />}
          <div className="flex-1">
            <h2 className="font-semibold text-base leading-tight">{anime.titleRomaji}</h2>
            {anime.titleEnglish && <p className="text-slate-400">{anime.titleEnglish}</p>}
            <p className="text-xs text-slate-500 mt-1">
              {anime.year ?? '?'} · {anime.format ?? '?'} · {anime.episodes ?? '?'} rész · {anime.studio ?? '?'}
            </p>
            <p className="text-xs text-slate-500">{anime.genres.join(', ')}</p>
            <a
              href={`https://anilist.co/anime/${anime.anilistId}`}
              target="_blank" rel="noreferrer"
              className="text-xs text-cyan-400 hover:underline"
            >AniList ↗</a>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={anime.status}
            onChange={(e) => patch({ status: e.target.value })}
            className="bg-slate-800 rounded px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-1">
            Rész:
            <input
              type="number" min={0} value={anime.progress}
              onChange={(e) => patch({ progress: Number(e.target.value) })}
              className="w-16 bg-slate-800 rounded px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            Pont:
            <input
              type="number" min={1} max={10} value={anime.myScore ?? ''}
              onChange={(e) => patch({ myScore: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-14 bg-slate-800 rounded px-2 py-1"
            />
          </label>
        </div>

        <section>
          <h3 className="font-semibold mb-1">Véleményem</h3>
          <textarea
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            rows={5}
            placeholder="Mi tetszett? Mi nem? Írd le szabadon…"
            className="w-full rounded-lg bg-slate-800 border border-slate-600 p-2 outline-none focus:border-cyan-400"
          />
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => saveOpinion()}
              disabled={saving || !opinion.trim()}
              className="rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-3 py-1 disabled:opacity-40"
            >{saving ? 'Mentés…' : 'Mentés + AI-kivonat'}</button>
            {extractStatus === 'failed' && (
              <button onClick={() => saveOpinion(true)} className="text-amber-400 hover:underline">
                Kivonat újra ↻
              </button>
            )}
            {extractStatus === 'done' && <span className="text-emerald-400 text-xs">✓ kivonatolva</span>}
          </div>
        </section>

        {myFacts.length > 0 && (
          <section>
            <h3 className="font-semibold mb-1">Ízlés-memória</h3>
            <ul className="flex flex-col gap-1">
              {myFacts.map((f) => (
                <li key={f.id} className="flex items-start gap-2 rounded bg-slate-900 px-2 py-1">
                  <span className={`${KIND_BADGE[f.kind] ?? ''} text-xs mt-0.5`}>
                    {f.kind === 'like' ? '▲' : f.kind === 'dislike' ? '▼' : '•'}
                  </span>
                  <span className="flex-1">{f.text}</span>
                  <button onClick={() => deleteFact(f.id)} className="text-slate-500 hover:text-red-400">✕</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="font-semibold mb-1">Opening / trailer</h3>
          {anime.trailerSite === 'youtube' && anime.trailerId ? (
            <iframe
              className="w-full aspect-video rounded-lg"
              src={`https://www.youtube-nocookie.com/embed/${anime.trailerId}`}
              title="Trailer"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(anime.titleRomaji + ' opening')}`}
              target="_blank" rel="noreferrer"
              className="text-cyan-400 hover:underline"
            >Opening keresése YouTube-on ↗</a>
          )}
        </section>

        <button onClick={remove} className="text-red-400 hover:underline self-start">Anime törlése</button>
      </div>
    </aside>
  )
}
