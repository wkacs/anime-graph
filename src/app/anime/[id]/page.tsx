'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import CharacterGrid from '@/components/CharacterGrid'
import { stripHtml } from '@/lib/description'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { AnimeTheme } from '@/lib/themes'
import type { ApiAnime, ApiFact } from '@/lib/types'

const STATUS_OPTIONS = ['watching', 'completed', 'planned', 'dropped'] as const

const KIND_MARK: Record<string, { glyph: string; cls: string }> = {
  like: { glyph: '▲', cls: 'text-[color:var(--status-watching)]' },
  dislike: { glyph: '▼', cls: 'text-[color:var(--status-dropped)]' },
  note: { glyph: '•', cls: 'text-text-3' },
}

type Opinion = { rawText: string; extractStatus: string } | null

export default function AnimePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [anime, setAnime] = useState<ApiAnime | null>(null)
  const [facts, setFacts] = useState<ApiFact[]>([])
  const [opinion, setOpinion] = useState('')
  const [extractStatus, setExtractStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [finishPrompt, setFinishPrompt] = useState(false)
  const [finishScore, setFinishScore] = useState<number | null>(null)
  const [finishText, setFinishText] = useState('')
  const [themes, setThemes] = useState<AnimeTheme[]>([])
  const [activeTheme, setActiveTheme] = useState<AnimeTheme | null>(null)
  const [streamLinks, setStreamLinks] = useState<{ site: string; url: string }[]>([])

  const load = useCallback(async () => {
    const res = await fetch(`/api/anime/${id}`)
    if (!res.ok) { setNotFound(true); return }
    const json = await res.json() as { anime: ApiAnime; opinion: Opinion; facts: ApiFact[] }
    setAnime(json.anime)
    setFacts(json.facts)
    if (json.opinion) {
      setOpinion((prev) => prev || json.opinion!.rawText)
      setExtractStatus(json.opinion.extractStatus)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!anime?.anilistId) return
    fetch(`/api/themes/${anime.anilistId}`)
      .then((r) => r.json())
      .then((j) => {
        setThemes(j.themes ?? [])
        setActiveTheme((j.themes ?? [])[0] ?? null)
      })
      .catch(() => { /* marad a trailer-fallback */ })
    fetch(`/api/links/${anime.anilistId}`)
      .then((r) => r.json())
      .then((j) => setStreamLinks(j.links ?? []))
      .catch(() => { /* linkek nélkül is él az oldal */ })
  }, [anime?.anilistId])

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/anime/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    // frissen befejezett anime pont/vélemény nélkül → egy lépéses értékelő
    if (body.status === 'completed' && anime && (anime.myScore == null || !opinion.trim())) {
      setFinishScore(anime.myScore)
      setFinishText(opinion)
      setFinishPrompt(true)
    }
    load()
  }

  async function saveFinish() {
    if (finishScore != null && finishScore !== anime?.myScore) {
      await fetch(`/api/anime/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myScore: finishScore }),
      })
    }
    setFinishPrompt(false)
    if (finishText.trim() && finishText.trim() !== opinion.trim()) {
      setOpinion(finishText)
      setSaving(true)
      const res = await fetch('/api/opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animeId: Number(id), rawText: finishText }),
      })
      const json = await res.json()
      setExtractStatus(json.extractStatus)
      setSaving(false)
    }
    load()
  }

  async function saveOpinion(retry = false) {
    setSaving(true)
    const res = await fetch('/api/opinion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retry ? { animeId: Number(id), retry: true } : { animeId: Number(id), rawText: opinion }),
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
    if (!anime || !confirm(`Törlöd: ${anime.titleRomaji}?`)) return
    const res = await fetch(`/api/anime/${id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => null)
    if (json?.bundle) {
      // a lista-oldal undo-toastja ebből tud visszaállítani
      sessionStorage.setItem('anime-graph-undo', JSON.stringify(json.bundle))
    }
    router.push('/lista')
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-3xl px-10 py-12 text-center">
          <p className="label-mono mb-2">404</p>
          <p className="text-sm text-text-2">Ez az anime nincs a listádban.</p>
          <Link href="/" className="btn-solid inline-block mt-5 px-5 py-2 text-sm">Vissza a gráfhoz</Link>
        </div>
      </main>
    )
  }

  if (!anime) return null

  return (
    <main className="min-h-screen pb-16">
      {/* blurred banner backdrop */}
      {(anime.bannerUrl ?? anime.coverUrl) && (
        <div className="fixed inset-x-0 top-0 h-[42vh] -z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anime.bannerUrl ?? anime.coverUrl!}
            alt=""
            className="w-full h-full object-cover opacity-25 blur-2xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#09090b]" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-28 flex flex-col gap-5">
        {/* hero */}
        <header className="flex flex-col sm:flex-row gap-6">
          {anime.coverUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={anime.coverUrl} alt="" className="w-40 rounded-2xl border border-white/10 shadow-2xl self-start" />
          )}
          <div className="flex-1 min-w-0 pt-1">
            <p className="label-mono mb-2 flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: STATUS_CSS_VARS[anime.status] ?? 'white' }}
              />
              {STATUS_LABELS[anime.status] ?? anime.status}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">{anime.titleRomaji}</h1>
            {anime.titleNative && <p className="text-text-3 mt-1">{anime.titleNative}</p>}
            {anime.titleEnglish && anime.titleEnglish !== anime.titleRomaji && (
              <p className="text-text-2 text-sm mt-0.5">{anime.titleEnglish}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {[
                anime.year != null ? String(anime.year) : null,
                anime.format,
                anime.mediaType === 'MANGA'
                  ? (anime.chapters != null ? `${anime.chapters} fejezet` : anime.volumes != null ? `${anime.volumes} kötet` : null)
                  : (anime.episodes != null ? `${anime.episodes} rész` : null),
                anime.mediaType !== 'MANGA' && anime.durationMin != null ? `${anime.durationMin} perc` : null,
                anime.studio,
                anime.avgScore != null ? `AniList ${anime.avgScore}%` : null,
                anime.rewatchCount > 0 ? `↻ ×${anime.rewatchCount} újranézve` : null,
              ].filter(Boolean).map((chip) => (
                <span key={chip} className="glass rounded-full px-3 py-1 text-xs font-mono text-text-2">{chip}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {anime.genres.map((g) => (
                <span key={g} className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-2">{g}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {streamLinks.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank" rel="noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-text-1 hover:bg-white/10 transition-colors"
                >
                  ▶ {l.site}
                </a>
              ))}
              <a
                href={`https://anilist.co/${anime.mediaType === 'MANGA' ? 'manga' : 'anime'}/${anime.anilistId}`}
                target="_blank" rel="noreferrer"
                className="text-xs text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
              >AniList ↗</a>
            </div>
          </div>
        </header>

        {/* controls */}
        <section className="glass rounded-3xl p-5 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-2">
            Státusz
            <select
              value={anime.status}
              onChange={(e) => patch({ status: e.target.value })}
              className="field px-3 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-text-2">
            {anime.mediaType === 'MANGA' ? 'Fejezet' : 'Rész'}
            <input
              type="number" min={0} value={anime.progress}
              onChange={(e) => patch({ progress: Number(e.target.value) })}
              className="field w-20 px-3 py-1.5 text-sm"
            />
            <span className="text-text-3">/ {(anime.mediaType === 'MANGA' ? anime.chapters : anime.episodes) ?? '?'}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-text-2">
            Pontom
            <input
              type="number" min={1} max={10} value={anime.myScore ?? ''}
              placeholder="–"
              onChange={(e) => patch({ myScore: e.target.value === '' ? null : Number(e.target.value) })}
              className="field w-16 px-3 py-1.5 text-sm"
            />
            <span className="text-text-3">/ 10</span>
          </label>
          {anime.status === 'completed' && (
            <button
              onClick={() => { if (confirm('Újranézed? A progressz nullázódik, a számláló nő.')) patch({ rewatch: true }) }}
              className="btn-ghost border border-white/10 px-3.5 py-1.5 text-sm ml-auto"
            >
              ↻ Újranézés indítása
            </button>
          )}
        </section>

        {/* description */}
        {anime.description && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-2">Leírás</p>
            <p className="text-sm text-text-1 leading-relaxed">{stripHtml(anime.description)}</p>
          </section>
        )}

        {/* characters */}
        <CharacterGrid anilistId={anime.anilistId} animeId={anime.id} />

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
            <button
              onClick={() => saveOpinion()}
              disabled={saving || !opinion.trim()}
              className="btn-solid px-5 py-2 text-sm"
            >{saving ? 'Mentés…' : 'Mentés + AI-kivonat'}</button>
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

        {/* openings & endings (animethemes.moe), fallback: trailer */}
        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-3">{themes.length ? 'Openingek & endingek' : 'Opening / trailer'}</p>
          {themes.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {themes.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => setActiveTheme(t)}
                    className={`rounded-full px-3 py-1 text-xs font-mono transition-colors ${
                      activeTheme?.slug === t.slug
                        ? 'bg-white text-black font-semibold'
                        : 'bg-white/6 text-text-2 hover:bg-white/12'
                    }`}
                  >
                    {t.slug}
                  </button>
                ))}
              </div>
              {activeTheme && (
                <>
                  <video
                    key={activeTheme.videoUrl}
                    src={activeTheme.videoUrl}
                    controls
                    preload="none"
                    poster={anime.bannerUrl ?? undefined}
                    className="w-full aspect-video rounded-2xl bg-black"
                  />
                  {activeTheme.song && (
                    <p className="label-mono mt-2">
                      {activeTheme.song}{activeTheme.artist ? ` — ${activeTheme.artist}` : ''}
                    </p>
                  )}
                </>
              )}
            </>
          ) : anime.trailerSite === 'youtube' && anime.trailerId ? (
            <iframe
              className="w-full aspect-video rounded-2xl"
              src={`https://www.youtube-nocookie.com/embed/${anime.trailerId}`}
              title="Trailer"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(anime.titleRomaji + ' opening')}`}
              target="_blank" rel="noreferrer"
              className="text-sm text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
            >Opening keresése YouTube-on ↗</a>
          )}
        </section>

        {/* relations */}
        {anime.relations.length > 0 && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">Kapcsolódó</p>
            <ul className="flex flex-col gap-1.5">
              {anime.relations.map((r) => (
                <li key={`${r.type}-${r.anilistId}`} className="flex items-center gap-3 text-sm">
                  <span className="label-mono w-24 shrink-0">{r.type.toLowerCase().replace('_', ' ')}</span>
                  <a
                    href={`https://anilist.co/anime/${r.anilistId}`}
                    target="_blank" rel="noreferrer"
                    className="text-text-2 hover:text-text-1 truncate"
                  >{r.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          onClick={remove}
          className="self-start text-sm text-text-3 hover:text-[color:var(--status-dropped)] transition-colors"
        >
          Anime törlése a listából
        </button>
      </div>

      {/* frissen befejezve → pont + vélemény egy lépésben */}
      {finishPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setFinishPrompt(false)}>
          <div
            className="glass-strong rounded-3xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="label-mono mb-1">Befejezted 🎉</p>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Milyen volt?</h2>
            <div className="flex gap-1 mb-4">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setFinishScore(n)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-mono transition-colors ${
                    finishScore === n
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/6 text-text-2 hover:bg-white/12'
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
              <button onClick={() => setFinishPrompt(false)} className="btn-ghost px-4 py-2 text-sm">
                Kihagyom
              </button>
              <button onClick={saveFinish} className="btn-solid px-5 py-2 text-sm">
                Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
