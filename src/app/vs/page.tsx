'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import type { CompareResult } from '@/lib/compare'

type Result = CompareResult & { username: string }

export default function VsPage() {
  const [username, setUsername] = useState('')
  const [mode, setMode] = useState<'anilist' | 'internal'>('anilist')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())

  async function run() {
    if (!username.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        mode === 'internal'
          ? { internalUsername: username.trim() }
          : { username: username.trim() },
      ),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Hiba történt'); return }
    setResult(json)
  }

  async function addToPlanned(anilistId: number) {
    const res = await fetch('/api/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId }),
    })
    if (res.ok) setAdded((s) => new Set(s).add(anilistId))
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">VS — ízlés-összehasonlítás</h1>
        <p className="text-sm text-text-2 mt-1">
          {mode === 'anilist'
            ? 'Írd be egy barátod AniList-nevét (publikus listával), és megnézzük, mennyire passzoltok.'
            : 'Írd be egy itteni regisztrált felhasználó nevét, és összevetjük a listáitokat.'}
        </p>
      </div>

      <div className="glass rounded-3xl p-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {([['anilist', 'AniList user'], ['internal', 'Belső user']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setResult(null) }}
              className={`px-3 py-1.5 text-xs transition-colors ${
                mode === m ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run() }}
          placeholder={mode === 'anilist' ? 'AniList felhasználónév' : 'Belső felhasználónév'}
          className="field flex-1 min-w-48 rounded-full px-4 py-2.5 text-sm"
        />
        <button onClick={run} disabled={loading || !username.trim()} className="btn-solid px-5 py-2.5 text-sm">
          {loading ? 'Összevetés…' : 'Összevetés'}
        </button>
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-3xl px-5 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums">{result.overlapPct}%</p>
              <p className="label-mono mt-1">átfedés</p>
            </div>
            <div className="glass rounded-3xl px-5 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums">{result.commonCount}</p>
              <p className="label-mono mt-1">közös anime</p>
            </div>
            <div className="glass rounded-3xl px-5 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums">{result.theirsCount}</p>
              <p className="label-mono mt-1">{result.username} listája</p>
            </div>
          </div>

          {result.commonFavorites.length > 0 && (
            <section>
              <p className="label-mono mb-2">Közös kedvencek</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.commonFavorites.map((f) => (
                  <li key={f.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.coverUrl && <img src={f.coverUrl} alt="" className="w-10 rounded-lg" />}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{f.title}</span>
                    <span className="label-mono shrink-0">te {f.myScore} · ő {f.theirScore}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.theyRecommend.length > 0 && (
            <section>
              <p className="label-mono mb-2">{result.username} látta — te még nem</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.theyRecommend.map((t) => (
                  <li key={t.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.coverUrl && <img src={t.coverUrl} alt="" className="w-10 rounded-lg" />}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{t.title}</span>
                    {t.score != null && <span className="label-mono shrink-0">ő: {t.score}/10</span>}
                    <button
                      onClick={() => addToPlanned(t.anilistId)}
                      disabled={added.has(t.anilistId)}
                      className="btn-ghost border border-white/10 px-2.5 py-1 text-xs shrink-0 disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                    >
                      {added.has(t.anilistId) ? '✓' : '+ Terv'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.iRecommend.length > 0 && (
            <section>
              <p className="label-mono mb-2">Te láttad — ajánld neki</p>
              <ul className="flex flex-wrap gap-2">
                {result.iRecommend.map((m) => (
                  <li key={m.anilistId} className="glass rounded-full px-4 py-1.5 text-sm">
                    {m.title}{m.myScore != null && <span className="text-text-3 font-mono text-xs"> · {m.myScore}/10</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </motion.div>
      )}
    </main>
  )
}
