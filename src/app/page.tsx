'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Graph3D from '@/components/Graph3D'
import HierarchyPanel from '@/components/HierarchyPanel'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import RecommendMorph from '@/components/RecommendMorph'
import { buildGraph, buildTimeline, COVER_AUTO_LIMIT, DEFAULT_CONFIG, type GraphConfig } from '@/lib/graph-builder'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime, ApiFact } from '@/lib/types'

const CONFIG_KEY = 'anime-graph-config'

export default function Home() {
  const [animeList, setAnimeList] = useState<ApiAnime[]>([])
  const [, setFacts] = useState<ApiFact[]>([])
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_CONFIG)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const [flythrough, setFlythrough] = useState(0) // 0 = normál mód, timestamp = idővonal
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) {
      try { setConfig(JSON.parse(saved)) } catch { /* keep default */ }
      setLoaded(true)
      return
    }
    // no local config yet → fall back to the saved default from settings
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

  const openAnime = useCallback((id: number) => router.push(`/anime/${id}`), [router])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/anime')
    if (res.ok) {
      const json = await res.json()
      setAnimeList(json.anime)
      setFacts(json.facts)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const timelineMode = flythrough !== 0

  const graph = useMemo(() => {
    const rows = animeList.map((a) => ({
      id: a.id, anilistId: a.anilistId, titleRomaji: a.titleRomaji,
      coverUrl: a.coverUrl, genres: a.genres, studio: a.studio, year: a.year,
      status: a.status, myScore: a.myScore, elo: a.elo, relations: a.relations,
      watchedAt: a.watchedAt, createdAt: a.createdAt,
    }))
    return timelineMode ? buildTimeline(rows) : buildGraph(rows, config)
  }, [animeList, config, timelineMode])

  const hoverAnime = hoverId != null ? animeList.find((a) => a.id === hoverId) ?? null : null

  // covers stay visible in every mode except the explicit dot fallback;
  // 'auto' just drops the name labels + shrinks textures on big libraries
  const coverMode = config.covers ?? 'auto'
  const nodeMode =
    coverMode === 'off' ? 'dot' as const
    : coverMode === 'on' || animeList.length <= COVER_AUTO_LIMIT ? 'full' as const
    : 'lite' as const

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
      />

      <div className="fixed top-20 left-4 z-20">
        <AddAnimeSearch onAdded={refresh} />
      </div>

      <div className="fixed bottom-4 left-4 z-20 flex items-end gap-2">
        {!timelineMode && <HierarchyPanel config={config} onChange={updateConfig} />}
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

      {animeList.length === 0 && (
        <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-3xl px-8 py-6 text-center">
            <p className="label-mono mb-2">Üres univerzum</p>
            <p className="text-sm text-text-2">Add hozzá az első animét a bal felső keresővel.</p>
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
                className="inline-block w-2 h-2 rounded-full"
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
