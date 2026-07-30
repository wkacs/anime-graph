'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { scoreColor } from '@/lib/score-color'
import type { CompareResult } from '@/lib/compare'

type Result = CompareResult & { username: string; otherUserId?: number | null }

type DuoPick = { anilistId: number; title: string; coverUrl: string | null; reason: string }

type GroupPick = { anilistId: number; title: string; coverUrl: string | null; slug: string; groupScore: number; perMember: (number | null)[] }
type GroupResult = { members: string[]; picks: GroupPick[] }

export default function VsPage() {
  const t = useTranslations('vs')
  const [username, setUsername] = useState('')
  const [mode, setMode] = useState<'anilist' | 'internal'>('anilist')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [duo, setDuo] = useState<DuoPick[] | null>(null)
  const [duoLoading, setDuoLoading] = useState(false)
  const [duoError, setDuoError] = useState('')
  const [groupNames, setGroupNames] = useState('')
  const [group, setGroup] = useState<GroupResult | null>(null)
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupError, setGroupError] = useState('')

  async function run() {
    if (!username.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setDuo(null)
    setDuoError('')
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
    if (!res.ok) { setError(json.error ?? t('genericError')); return }
    setResult(json)
  }

  async function runDuo() {
    if (!result?.otherUserId) return
    setDuoLoading(true); setDuoError(''); setDuo(null)
    const res = await fetch('/api/recommend/duo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherUserId: result.otherUserId }),
    })
    const json = await res.json()
    setDuoLoading(false)
    if (!res.ok) { setDuoError(json.error ?? t('genericError')); return }
    setDuo(json.picks ?? [])
  }

  async function runGroup() {
    const usernames = groupNames.split(',').map((s) => s.trim()).filter(Boolean)
    if (!usernames.length) return
    setGroupLoading(true); setGroupError(''); setGroup(null)
    const res = await fetch('/api/group-pick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames }),
    })
    const json = await res.json()
    setGroupLoading(false)
    if (!res.ok) { setGroupError(json.error ?? t('genericError')); return }
    setGroup(json)
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
    <main className="min-h-screen max-w-3xl mx-auto px-4 pt-24 pb-24 md:pb-16 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-text-2 mt-1">
          {mode === 'anilist' ? t('introAnilist') : t('introInternal')}
        </p>
      </div>

      <div className="glass rounded-3xl p-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {([['anilist', t('modeAnilist')], ['internal', t('modeInternal')]] as const).map(([m, label]) => (
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
          placeholder={mode === 'anilist' ? t('placeholderAnilist') : t('placeholderInternal')}
          className="field flex-1 min-w-48 rounded-full px-4 py-2.5 text-sm"
        />
        <button onClick={run} disabled={loading || !username.trim()} className="btn-solid px-5 py-2.5 text-sm">
          {loading ? t('comparing') : t('compareCta')}
        </button>
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-3xl px-5 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums">{result.overlapPct}%</p>
              <p className="label-mono mt-1">{t('overlap')}</p>
            </div>
            <div className="glass rounded-3xl px-5 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums">{result.commonCount}</p>
              <p className="label-mono mt-1">{t('commonAnime')}</p>
            </div>
            <div className="glass rounded-3xl px-5 py-4 text-center">
              <p className="text-3xl font-semibold tabular-nums">{result.theirsCount}</p>
              <p className="label-mono mt-1">{t('theirList', { name: result.username })}</p>
            </div>
          </div>

          {mode === 'internal' && result.otherUserId != null && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="label-mono">{t('duoHeading')}</p>
                <button onClick={runDuo} disabled={duoLoading} className="btn-solid px-4 py-2 text-sm">
                  {duoLoading ? t('duoThinking') : duo ? t('duoAgain') : t('duoCta')}
                </button>
              </div>
              {duoError && <p className="text-sm text-[color:var(--status-dropped)]">{duoError}</p>}
              {duo && (
                <ul className="flex flex-col gap-2">
                  {duo.map((p) => (
                    <li key={p.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.coverUrl && <img src={p.coverUrl} alt="" className="w-10 rounded-lg" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-text-2">{p.reason}</p>
                      </div>
                      <button
                        onClick={() => addToPlanned(p.anilistId)}
                        disabled={added.has(p.anilistId)}
                        className="btn-ghost border border-white/10 px-2.5 py-1 text-xs shrink-0 disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                      >
                        {added.has(p.anilistId) ? '✓' : t('addPlan')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {result.commonFavorites.length > 0 && (
            <section>
              <p className="label-mono mb-2">{t('commonFavorites')}</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.commonFavorites.map((f) => (
                  <li key={f.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.coverUrl && <img src={f.coverUrl} alt="" className="w-10 rounded-lg" />}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{f.title}</span>
                    <span className="label-mono shrink-0">{t('youVsThem', { mine: f.myScore ?? '–', theirs: f.theirScore ?? '–' })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.theyRecommend.length > 0 && (
            <section>
              <p className="label-mono mb-2">{t('theyRecommend', { name: result.username })}</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* `item`, nem `t`: a fordító hookot árnyékolná */}
                {result.theyRecommend.map((item) => (
                  <li key={item.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.coverUrl && <img src={item.coverUrl} alt="" className="w-10 rounded-lg" />}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{item.title}</span>
                    {item.score != null && <span className="label-mono shrink-0">{t('theirScore', { score: item.score })}</span>}
                    <button
                      onClick={() => addToPlanned(item.anilistId)}
                      disabled={added.has(item.anilistId)}
                      className="btn-ghost border border-white/10 px-2.5 py-1 text-xs shrink-0 disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                    >
                      {added.has(item.anilistId) ? '✓' : t('addPlan')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.iRecommend.length > 0 && (
            <section>
              <p className="label-mono mb-2">{t('iRecommend')}</p>
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

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('clubHeading')}</p>
        <p className="text-sm text-text-2 mb-2">
          {t('clubIntro')}
        </p>
        <details className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-text-2 mb-4">
          <summary className="cursor-pointer text-text-1 select-none">{t('clubHow')}</summary>
          <p className="mt-2 leading-relaxed">{t('clubHowText')}</p>
        </details>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={groupNames}
            onChange={(e) => setGroupNames(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runGroup() }}
            placeholder={t('clubPlaceholder')}
            className="field flex-1 min-w-[200px] px-4 py-2 text-sm"
          />
          <button onClick={runGroup} disabled={groupLoading} className="btn-solid px-4 py-2 text-sm">
            {groupLoading ? t('clubCalc') : t('clubCta')}
          </button>
        </div>
        {groupError && <p className="text-sm text-[color:var(--status-dropped)] mt-3">{groupError}</p>}
        {group && (
          <>
            <p className="label-mono mt-5 mb-2">{t('members', { names: group.members.join(' · ') })}</p>
            {group.picks.length === 0 && (
              <p className="text-sm text-text-3">{t('clubEmpty')}</p>
            )}
            <ul className="flex flex-col gap-2">
              {group.picks.map((p) => (
                <li key={p.anilistId} className="glass rounded-2xl p-3 flex gap-3 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="w-10 rounded-lg" />}
                  <div className="min-w-0 flex-1">
                    <a href={`/anime/${p.slug}`} className="text-sm font-medium hover:underline underline-offset-4">{p.title}</a>
                    <div className="flex flex-col gap-1 mt-1.5">
                      {p.perMember.map((m, i) => (
                        <div key={`${group.members[i] ?? i}`} className="flex items-center gap-2">
                          <span className="label-mono !text-[9px] w-16 shrink-0 truncate">{group.members[i] ?? t('memberN', { n: i + 1 })}</span>
                          {m == null ? (
                            <span className="text-[10px] text-text-3">{t('noData')}</span>
                          ) : (
                            <>
                              <span className="h-1.5 rounded-full bg-white/10 flex-1 max-w-36 overflow-hidden">
                                <span
                                  className={`block h-full rounded-full ${m < 45 ? 'bg-amber-400/70' : 'bg-white/60'}`}
                                  style={{ width: `${m}%` }}
                                  title={m < 45 ? t('vetoNear') : undefined}
                                />
                              </span>
                              <span className={`font-mono text-[10px] shrink-0 ${m < 45 ? 'text-amber-300/90' : 'text-text-2'}`}>{m}%</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <span
                    className="font-mono font-semibold shrink-0"
                    style={{ color: scoreColor(p.groupScore, 'fit') }}
                  >
                    {p.groupScore}%
                  </span>
                  <button
                    onClick={() => addToPlanned(p.anilistId)}
                    disabled={added.has(p.anilistId)}
                    className="btn-ghost border border-white/10 px-2.5 py-1 text-xs shrink-0 disabled:text-[color:var(--status-watching)] disabled:border-transparent"
                  >
                    {added.has(p.anilistId) ? '✓' : t('addPlan')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}
