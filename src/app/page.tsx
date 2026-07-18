'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Graph3D from '@/components/Graph3D'
import HierarchyPanel from '@/components/HierarchyPanel'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import SidePanel from '@/components/SidePanel'
import { buildGraph, DEFAULT_CONFIG, type GraphConfig } from '@/lib/graph-builder'
import type { ApiAnime, ApiFact } from '@/lib/types'

const CONFIG_KEY = 'anime-graph-config'

export default function Home() {
  const [animeList, setAnimeList] = useState<ApiAnime[]>([])
  const [facts, setFacts] = useState<ApiFact[]>([])
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_CONFIG)
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) try { setConfig(JSON.parse(saved)) } catch { /* keep default */ }
    setLoaded(true)
  }, [])

  function updateConfig(c: GraphConfig) {
    setConfig(c)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  }

  const refresh = useCallback(async () => {
    const res = await fetch('/api/anime')
    if (res.ok) {
      const json = await res.json()
      setAnimeList(json.anime)
      setFacts(json.facts)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const graph = useMemo(() => buildGraph(
    animeList.map((a) => ({
      id: a.id, anilistId: a.anilistId, titleRomaji: a.titleRomaji,
      coverUrl: a.coverUrl, genres: a.genres, studio: a.studio, year: a.year,
      status: a.status, myScore: a.myScore, elo: a.elo, relations: a.relations,
    })),
    config,
  ), [animeList, config])

  const selectedAnime = animeList.find((a) => a.id === selectedAnimeId) ?? null

  if (!loaded) return null

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Graph3D data={graph} onAnimeClick={setSelectedAnimeId} focusNodeId={null} />
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3">
        <AddAnimeSearch onAdded={refresh} />
        <HierarchyPanel config={config} onChange={updateConfig} />
      </div>
      {/* Task 12 mounts the Recommend button here (top-right) */}
      {selectedAnime && (
        <SidePanel
          anime={selectedAnime}
          facts={facts}
          onClose={() => setSelectedAnimeId(null)}
          onChanged={refresh}
        />
      )}
    </main>
  )
}
