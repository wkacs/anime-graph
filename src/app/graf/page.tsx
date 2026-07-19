'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Graph3D from '@/components/Graph3D'
import HierarchyPanel from '@/components/HierarchyPanel'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import RecommendMorph from '@/components/RecommendMorph'
import {
  buildBubbles, buildGenreDetail, buildGraph, buildTimeline,
  COVER_AUTO_LIMIT, DEFAULT_CONFIG, type GraphConfig, type GraphNode,
} from '@/lib/graph-builder'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime, ApiFact } from '@/lib/types'

const CONFIG_KEY = 'anime-graph-config'
const VIEW_KEY = 'anime-graph-view'
const HINT_KEY = 'anime-graph-hint-seen'

export default function GrafPage() {
  const [animeList, setAnimeList] = useState<ApiAnime[]>([])
  const [, setFacts] = useState<ApiFact[]>([])
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_CONFIG)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const [flythrough, setFlythrough] = useState(0) // 0 = nem idővonal, timestamp = idővonal
  const [advanced, setAdvanced] = useState(false)
  const [focusGenre, setFocusGenre] = useState<string | null>(null)
  const [fitKey, setFitKey] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [yearCutoff, setYearCutoff] = useState<number | null>(null) // null = teljes térkép
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) try { setConfig(JSON.parse(saved)) } catch { /* keep default */ }
    setAdvanced(localStorage.getItem(VIEW_KEY) === 'advanced')
    setShowHint(!localStorage.getItem(HINT_KEY))
    if (saved) { setLoaded(true); return }
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => { if (j.hierarchyDefault) setConfig(j.hierarchyDefault) })
      .catch(() => { /* keep default */ })
      .finally(() => setLoaded(true))
  }, [])

  function updateConfig(c: GraphConfig) {
    setConfig(c)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  }

  function setView(adv: boolean) {
    setAdvanced(adv)
    setFocusGenre(null)
    localStorage.setItem(VIEW_KEY, adv ? 'advanced' : 'simple')
    setFitKey(Date.now())
  }

  const openAnime = useCallback((id: number) => router.push(`/anime/${id}`), [router])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/anime')
    if (res.ok) {
      const json = await res.json()
      setAnimeList(json.anime)
      setFacts(json.facts)
    }
  }, [])

  // új anime a keresőből → ugorjunk oda, ahova a gráfban került
  const flyToAnime = useCallback((a: ApiAnime) => {
    if (!advanced && flythrough === 0) {
      setFocusGenre(a.genres[0] ?? 'Ismeretlen')
    }
    setFocusNodeId(`anime:${a.id}`)
    setTimeout(() => setFocusNodeId(null), 12000)
  }, [advanced, flythrough])

  const handleAdded = useCallback((added?: ApiAnime) => {
    refresh()
    if (added) flyToAnime(added)
  }, [refresh, flyToAnime])

  useEffect(() => { refresh() }, [refresh])

  const timelineMode = flythrough !== 0

  // időutazás: csak az adott év végéig megnézett/felvett animék
  const watchYear = (a: ApiAnime) => new Date(a.watchedAt ?? a.createdAt).getFullYear()
  const minYear = useMemo(
    () => (animeList.length ? Math.min(...animeList.map(watchYear)) : new Date().getFullYear()),
    [animeList],
  )
  const maxYear = new Date().getFullYear()

  const rows = useMemo(() => animeList
    .filter((a) => yearCutoff == null || watchYear(a) <= yearCutoff)
    .map((a) => ({
      id: a.id, anilistId: a.anilistId, titleRomaji: a.titleRomaji,
      coverUrl: a.coverUrl, genres: a.genres, studio: a.studio, year: a.year,
      status: a.status, myScore: a.myScore, relations: a.relations,
      tags: a.tags, watchedAt: a.watchedAt, createdAt: a.createdAt,
    })), [animeList, yearCutoff])

  const graph = useMemo(() => {
    if (timelineMode) return buildTimeline(rows)
    if (advanced) return buildGraph(rows, config)
    if (focusGenre) return buildGenreDetail(rows, focusGenre)
    return buildBubbles(rows)
  }, [rows, config, timelineMode, advanced, focusGenre])

  const animeNodeCount = useMemo(
    () => graph.nodes.filter((n) => n.type === 'anime').length,
    [graph],
  )

  const hoverAnime = hoverId != null ? animeList.find((a) => a.id === hoverId) ?? null : null

  // covers stay visible except the explicit dot fallback; 'auto' only drops
  // the name labels + shrinks textures when the current view is big
  const coverMode = config.covers ?? 'auto'
  const nodeMode =
    coverMode === 'off' ? 'dot' as const
    : coverMode === 'on' || animeNodeCount <= COVER_AUTO_LIMIT ? 'full' as const
    : 'lite' as const

  const handleDimClick = useCallback((n: GraphNode) => {
    if (n.dim !== 'genre') return
    if (n.bubble) {
      setFocusGenre(n.label)
      setFitKey(Date.now())
      localStorage.setItem(HINT_KEY, '1')
      setShowHint(false)
    } else {
      setFocusGenre(null)
      setFitKey(Date.now())
    }
  }, [])

  if (!loaded) return null

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
    >
      <Graph3D
        data={graph}
        onAnimeClick={openAnime}
        onAnimeHover={setHoverId}
        flythrough={flythrough}
        nodeMode={nodeMode}
        onDimClick={!advanced && !timelineMode ? handleDimClick : undefined}
        fitKey={fitKey}
        focusNodeId={focusNodeId}
      />

      <div className="fixed top-20 left-4 z-20">
        <AddAnimeSearch onAdded={handleAdded} ownList={animeList} onPickOwn={flyToAnime} />
      </div>

      {/* breadcrumb a drill-down nézetben */}
      {!advanced && !timelineMode && focusGenre && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => { setFocusGenre(null); setFitKey(Date.now()) }}
            className="glass rounded-full px-4 py-2 text-sm text-text-1 hover:bg-white/10 transition-colors"
          >
            ← Minden műfaj
            <span className="label-mono ml-2">{focusGenre} · {animeNodeCount}</span>
          </button>
        </div>
      )}

      <div className="fixed bottom-4 left-4 z-20 flex items-end gap-2">
        {advanced && !timelineMode && <HierarchyPanel config={config} onChange={updateConfig} />}
        {!timelineMode && (
          <button
            onClick={() => setView(!advanced)}
            className="glass rounded-full px-4 py-2.5 label-mono hover:bg-white/10 transition-colors"
          >
            {advanced ? 'Egyszerű nézet' : 'Haladó nézet'}
          </button>
        )}
        <button
          onClick={() => setFlythrough(timelineMode ? 0 : Date.now())}
          className={`glass rounded-full px-4 py-2.5 label-mono transition-colors ${
            timelineMode ? 'bg-white/15 !text-text-1' : 'hover:bg-white/10'
          }`}
        >
          {timelineMode ? '✕ Idővonal' : 'Idővonal'}
        </button>
      </div>

      <div className="fixed top-20 right-4 z-20">
        <RecommendMorph onAdded={refresh} />
      </div>

      {/* időutazás: így nőtt az univerzumod évről évre */}
      {!timelineMode && minYear < maxYear && (
        <div className="fixed bottom-4 right-4 z-20 glass rounded-full px-4 py-2.5 flex items-center gap-3">
          <span className="label-mono">Időutazás</span>
          <input
            type="range"
            min={minYear}
            max={maxYear + 1}
            value={yearCutoff ?? maxYear + 1}
            onChange={(e) => {
              const v = Number(e.target.value)
              setYearCutoff(v > maxYear ? null : v)
            }}
            className="w-36 accent-white"
          />
          <span className="font-mono text-xs text-text-1 w-12">
            {yearCutoff == null ? 'Teljes' : `≤ ${yearCutoff}`}
          </span>
        </div>
      )}

      {animeList.length === 0 && (
        <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-3xl px-8 py-6 text-center">
            <p className="label-mono mb-2">Üres univerzum</p>
            <p className="text-sm text-text-2">Add hozzá az első animét a bal felső keresővel.</p>
          </div>
        </div>
      )}

      {/* első látogatás: rövid vezetés */}
      {showHint && !advanced && !timelineMode && !focusGenre && animeList.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20">
          <div className="glass-strong rounded-2xl px-5 py-3 flex items-center gap-4 text-sm text-text-1">
            <span>
              Kattints egy buborékra a műfaj animéihez · húzással forgatsz · WASD + Q/E: repülés
            </span>
            <button
              onClick={() => { setShowHint(false); localStorage.setItem(HINT_KEY, '1') }}
              className="btn-ghost px-2 py-0.5 text-xs shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {hoverAnime && (
        <div
          className="glass-strong fixed z-30 w-64 rounded-2xl p-3 pointer-events-none flex gap-3"
          style={{
            left: Math.min(mouse.x + 18, typeof window !== 'undefined' ? window.innerWidth - 280 : mouse.x),
            top: Math.min(mouse.y + 18, typeof window !== 'undefined' ? window.innerHeight - 180 : mouse.y),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hoverAnime.coverUrl && <img src={hoverAnime.coverUrl} alt="" className="w-14 rounded-lg self-start" />}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{hoverAnime.titleRomaji}</p>
            {hoverAnime.titleNative && (
              <p className="text-[11px] text-text-3 leading-tight mt-0.5">{hoverAnime.titleNative}</p>
            )}
            <p className="label-mono mt-1.5">
              {hoverAnime.year ?? '?'} · {hoverAnime.format ?? '?'} · {hoverAnime.episodes ?? '?'} rész
            </p>
            <p className="flex items-center gap-1.5 mt-1.5 text-xs text-text-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${hoverAnime.status === 'watching' ? 'animate-pulse' : ''}`}
                style={{ background: STATUS_CSS_VARS[hoverAnime.status] ?? 'white' }}
              />
              {STATUS_LABELS[hoverAnime.status] ?? hoverAnime.status}
              {hoverAnime.myScore != null && <span className="text-text-3">· {hoverAnime.myScore}/10</span>}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
