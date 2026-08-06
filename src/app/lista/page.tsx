'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import OnboardingCTA from '@/components/OnboardingCTA'
import PageShell from '@/components/ui/PageShell'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { notify } from '@/components/ui/Toast'
import { mutate } from '@/lib/mutate'
import { useStatusLabel } from '@/components/useLabels'
import { filterByMedia, type MediaMode } from '@/lib/graph-builder'
import { STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime } from '@/lib/types'

type SortKey = 'titleRomaji' | 'year' | 'studio' | 'status' | 'myScore'

const FILTERS = ['all', 'watching', 'completed', 'planned', 'dropped'] as const

const MEDIA_MODES = ['ANIME', 'MANGA', 'ALL'] as const satisfies readonly MediaMode[]

export default function ListaPage() {
  // `null` = MÉG TÖLT, `[]` = tényleg üres a lista. Korábban mindkettő `[]`
  // volt, ezért egy 400 címes felhasználó is a „Kezdjük itt / Hozd át a
  // listád" onboarding-CTA-t kapta minden betöltéskor: az üres állapotot
  // használtuk betöltési állapotnak, ami félretájékoztat (§16).
  const [list, setList] = useState<ApiAnime[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [mediaMode, setMediaMode] = useState<MediaMode>('ANIME')
  const [sortKey, setSortKey] = useState<SortKey>('titleRomaji')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const router = useRouter()
  const t = useTranslations('list')
  const tc = useTranslations('common')
  const ts = useTranslations('status')
  const statusLabel = useStatusLabel()

  const reload = useCallback(() => {
    setLoadError(false)
    fetch('/api/anime')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => setList(j.anime ?? []))
      // hiba esetén NE üres listát mutassunk: az „nincs semmid"-et üzenne
      .catch(() => { setLoadError(true); setList([]) })
  }, [])

  useEffect(() => { reload() }, [reload])

  // profilra kitűzött címek (📌 oszlop)
  const [pinnedTitles, setPinnedTitles] = useState<number[] | null>(null)
  useEffect(() => {
    fetch('/api/pins')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { titles: { titleId: number }[] } | null) => {
        if (j) setPinnedTitles(j.titles.map((t) => t.titleId))
      })
      .catch(() => { /* kitűzés nélkül is él a lista */ })
  }, [])

  async function togglePin(titleId: number) {
    if (pinnedTitles == null) return
    const isPinned = pinnedTitles.includes(titleId)
    const next = isPinned ? pinnedTitles.filter((t) => t !== titleId) : [...pinnedTitles, titleId]
    // natív alert() helyett a közös sáv: ugyanez a művelet máshol (OwnerOverlay)
    // inline szöveget mutat, tehát két helyen kétféleképp viselkedett (§16.4)
    const res = await mutate('/api/pins', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: next }),
    })
    if (res.ok) setPinnedTitles(next)
    else notify(res.error ?? t('pinFailed'))
  }

  // egykattintasos haladas a soron: korabban ehhez meg kellett nyitni a
  // detail-oldalt
  async function bumpOne(a: ApiAnime) {
    const res = await mutate(`/api/anime/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: a.progress + 1 }),
    })
    // else-ág NÉLKÜL a hiba teljesen néma volt: a szám nem mozdult, üzenet
    // nem jött, tehát a felhasználó modellje „elromlott a gomb" lett (§16)
    if (!res.ok) { notify(res.error ?? tc('error')); return }
    setList((l) => (l ?? []).map((x) => (x.id === a.id ? { ...x, progress: x.progress + 1 } : x)))
  }

  // törlés utáni undo-toast (a detail-oldal teszi be a sessionStorage-ba)
  const [undoBundle, setUndoBundle] = useState<{ anime: { titleRomaji: string } } | null>(null)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiMatches, setAiMatches] = useState<Set<number> | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  useEffect(() => {
    const raw = sessionStorage.getItem('anime-graph-undo')
    if (!raw) return
    sessionStorage.removeItem('anime-graph-undo')
    try { setUndoBundle(JSON.parse(raw)) } catch { return }
    const t = setTimeout(() => setUndoBundle(null), 8000)
    return () => clearTimeout(t)
  }, [])

  async function undoDelete() {
    if (!undoBundle) return
    const res = await fetch('/api/anime/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle: undoBundle }),
    })
    setUndoBundle(null)
    if (res.ok) reload()
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(1) }
  }

  async function runNlSearch() {
    const query = q.trim()
    if (!query) return
    setAiLoading(true); setAiAnswer(null); setAiMatches(null)
    const res = await fetch('/api/search/nl', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const json = await res.json()
    setAiLoading(false)
    if (!res.ok) { setAiAnswer(json.error ?? tc('error')); return }
    setAiAnswer(json.answer)
    setAiMatches(new Set(json.matchIds))
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return filterByMedia(list ?? [], mediaMode)
      .filter((a) => filter === 'all' || a.status === filter)
      // AI-találat aktív: csak a matchelt sorok, a szöveges szűrő helyett
      .filter((a) => (aiMatches != null
        ? aiMatches.has(a.id)
        : !needle ||
          a.titleRomaji.toLowerCase().includes(needle) ||
          (a.titleEnglish ?? '').toLowerCase().includes(needle)))
      .sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (av == null && bv == null) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir
      })
  }, [list, q, filter, sortKey, sortDir, mediaMode, aiMatches])

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2.5 text-left ${className}`}>
      <button onClick={() => sortBy(k)} className="label-mono hover:text-text-1 transition-colors">
        {children}{sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <PageShell width="wide">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="display-l text-text-1 mr-auto">{t('heading')}</h1>
        <AddAnimeSearch onAdded={() => reload()} />
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-full border border-white/10 overflow-hidden">
          {MEDIA_MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMediaMode(m)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                mediaMode === m ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1'
              }`}
            >
              {t(`media_${m}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === f ? 'bg-white/12 text-text-1' : 'text-text-2 hover:text-text-1 hover:bg-white/5'
              }`}
            >
              {ts(f)}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey) runNlSearch() }}
          placeholder={t('searchPlaceholder')}
          className="field rounded-full px-4 py-2 text-sm w-52"
        />
        {/* A jelentés eddig KIZÁRÓLAG a tooltipben élt: „✨ AI" nem mondja
            meg, mit csinál a gomb — ha egy vezérlőt magyarázni kell, a
            leképezés gyenge (§16). Most a szó a címke, a csillag az ikon. */}
        <button
          onClick={runNlSearch}
          disabled={aiLoading || !q.trim()}
          aria-busy={aiLoading}
          title={t('aiSearchTooltip')}
          className="btn-ghost border border-white/10 rounded-full px-3 py-2 text-xs disabled:opacity-40"
        >
          <span aria-hidden className="mr-1">✨</span>
          {aiLoading ? t('askBusy') : t('askLabel')}
        </button>
      </div>

      {aiAnswer && (
        <p className="glass rounded-2xl px-4 py-3 text-sm text-text-1 mb-5">
          <span className="label-mono mr-2">✨ AI</span>{aiAnswer}
          <button
            onClick={() => { setAiAnswer(null); setAiMatches(null) }}
            className="ml-2 text-text-3 text-xs hover:text-text-1"
          >✕</button>
        </p>
      )}

      {/* NINCS overflow-hidden: az scroll-kontenert csinal, ami elrontja a
          <thead> position:sticky-jet. A sarok-lekerekites a tablan van. */}
      <div className="surface-1 rounded-[var(--r-lg)]">
        {list == null && (
          // BETÖLTÉS: vázlat, nem onboarding-CTA. A szomszédos /bongeszo
          // már így csinálja — a primitív megvolt, csak itt nem használtuk.
          <div className="px-4 py-6">
            <div className="flex flex-col gap-3"><Skeleton variant="row" count={8} /></div>
          </div>
        )}
        {list != null && loadError && (
          <div className="px-4 py-6">
            <EmptyState
              eyebrow={tc('error')}
              title={tc('error')}
              text={t('loadFailed')}
              action={<Button onClick={reload}>{tc('retry')}</Button>}
            />
          </div>
        )}
        {list != null && !loadError && rows.length === 0 && (
          <div className="px-4 py-6">
            {list.length === 0 ? (
              <OnboardingCTA compact />
            ) : (
              <EmptyState
                eyebrow={t('filterEyebrow')}
                title={t('noMatch')}
                text={t('noMatchText')}
                action={
                  <Button onClick={() => { setQ(''); setFilter('all'); setAiAnswer(null); setAiMatches(null) }}>
                    {t('clearFilters')}
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Mobil: poszter-rács. A táblázat 52px-es bélyegképe telefonon
            olvashatatlan volt (user-visszajelzés 2026-08-06); itt a borító a
            fő elem, a státusz pötty + pont a borítón ül. */}
        {list != null && !loadError && rows.length > 0 && (
          <div className="grid grid-cols-3 gap-3 p-3 sm:hidden">
            {rows.map((a) => (
              <button
                key={a.id}
                onClick={() => router.push(`/anime/${a.id}`)}
                className="group text-left"
              >
                <div className="relative">
                  {a.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.coverUrl}
                      alt=""
                      loading="lazy"
                      className="w-full rounded-[var(--r-sm)] object-cover"
                      style={{ aspectRatio: '2 / 3' }}
                    />
                  ) : (
                    <div className="w-full rounded-[var(--r-sm)] bg-white/5" style={{ aspectRatio: '2 / 3' }} />
                  )}
                  <span
                    className={`absolute left-1.5 top-1.5 inline-block h-2 w-2 rounded-full ring-2 ring-black/60 ${
                      a.status === 'watching' ? 'animate-pulse' : ''
                    }`}
                    style={{ background: STATUS_CSS_VARS[a.status] ?? 'white' }}
                    aria-label={statusLabel(a.status)}
                  />
                  {a.myScore != null && (
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/75 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-text-1">
                      {a.myScore}
                    </span>
                  )}
                  {pinnedTitles != null && pinnedTitles.includes(a.titleId) && (
                    <span aria-hidden className="absolute right-1 top-1 text-xs">📌</span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-text-2">{a.titleRomaji}</p>
              </button>
            ))}
          </div>
        )}

        {list != null && !loadError && rows.length > 0 && (
        <table className="hidden w-full text-15 rounded-[var(--r-lg)] sm:table">
          {/* A közel opak kitöltés MARAD: ez tartja olvashatóan a text-3
              oszlopcímkéket a gördülő poszter-sorok fölött. Ami változott: a
              kemény 1px-es elválasztó helyett halványuló él (§12 — az úszó
              króm alatt görgetés-él legyen, ne vonal). A top-érték a
              --nav-clearance tokenből jön, nem kézzel írt 4.5rem-ből. */}
          <thead className="sticky top-[var(--nav-clearance)] z-20 backdrop-blur-md bg-[#0d0d10]/95 [box-shadow:0_10px_10px_-10px_rgba(13,13,16,0.95)]">
            <tr>
              <th className="w-20" />
              <Th k="titleRomaji">{t('colTitle')}</Th>
              <Th k="year" className="hidden sm:table-cell">{t('colYear')}</Th>
              <Th k="studio" className="hidden md:table-cell">{t('colStudio')}</Th>
              <Th k="status">{t('colStatus')}</Th>
              <th className="px-3 py-2.5 text-left hidden lg:table-cell">
                <span className="label-mono">{t('colProgress')}</span>
              </th>
              <Th k="myScore" className="text-right">{t('colScore')}</Th>
              {/* a +1 hover-affordancia: mobilon nincs hover, es a 48px-es
                  oszlop 390px-en vizszintes tulcsordulast okozott */}
              <th className="w-12 hidden sm:table-cell" />
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/anime/${a.id}`)}
                className="group relative border-b border-white/5 last:border-0 hover:bg-white/[0.035] cursor-pointer transition-colors"
              >
                <td className="pl-3 py-2 relative">
                  {a.coverUrl && (
                    <>
                      {/* a poszter sajat szine izzik a sor bal szelen hoverre */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.coverUrl} alt="" aria-hidden
                        className="poster-glow opacity-0 group-hover:opacity-45"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.coverUrl} alt="" className="relative w-[52px] h-[72px] object-cover rounded-[var(--r-sm)] border border-white/10" />
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium leading-tight">{a.titleRomaji}</p>
                  {a.titleNative && <p className="text-xs text-text-3 leading-tight mt-1">{a.titleNative}</p>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-text-2 hidden sm:table-cell">{a.year ?? '–'}</td>
                <td className="px-3 py-2 text-text-2 hidden md:table-cell">{a.studio ?? '–'}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5 text-xs text-text-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${a.status === 'watching' ? 'animate-pulse' : ''}`}
                      style={{ background: STATUS_CSS_VARS[a.status] ?? 'white' }}
                    />
                    {statusLabel(a.status)}
                  </span>
                </td>
                <td className="px-3 py-2 hidden lg:table-cell w-28">
                  {a.episodes ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/45"
                          style={{ width: `${Math.min(100, Math.round((a.progress / a.episodes) * 100))}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-text-3 tabular-nums shrink-0">
                        {a.progress}/{a.episodes}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-text-3">{a.progress || '–'}</span>
                  )}
                </td>
                <td className="px-3 py-2 pr-4 text-right font-mono text-xs text-text-2">
                  {a.myScore != null ? `${a.myScore}/10` : '–'}
                </td>
                <td className="px-2 py-2 text-right hidden sm:table-cell">
                  <Button
                    onClick={(e) => { e.stopPropagation(); bumpOne(a) }}
                    title={t('watchedOneEpisode')}
                    className="opacity-40 group-hover:opacity-100 transition-opacity"
                  >
                    +1
                  </Button>
                </td>
                <td className="pr-3 py-2 text-right">
                  {pinnedTitles != null && (
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(a.titleId) }}
                      title={pinnedTitles.includes(a.titleId) ? t('unpinTooltip') : t('pinTooltip')}
                      className={`text-sm transition-opacity ${
                        pinnedTitles.includes(a.titleId) ? 'opacity-100' : 'opacity-25 hover:opacity-80'
                      }`}
                    >
                      📌
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      {list != null && (
        <p className="label-mono mt-3 text-right">{t('countOf', { shown: rows.length, total: list.length })}</p>
      )}

      {undoBundle && (
        // mobilon a toast a also tab-sav fole kerul, kulonben az fedne
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 surface-3 rounded-[var(--r-md)] px-5 py-3 flex items-center gap-4 text-sm">
          <span className="text-text-2">
            {t('deleted')} <span className="text-text-1">{undoBundle.anime.titleRomaji}</span>
          </span>
          <button onClick={undoDelete} className="btn-solid px-4 py-1.5 text-xs">{t('undo')}</button>
        </div>
      )}
    </PageShell>
  )
}
