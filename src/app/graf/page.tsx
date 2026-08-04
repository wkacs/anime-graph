'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { tweenFluid } from '@/lib/motion'
import { useTranslations } from 'next-intl'
import Graph3D from '@/components/Graph3D'
import HierarchyPanel from '@/components/HierarchyPanel'
import AddAnimeSearch from '@/components/AddAnimeSearch'
import OnboardingCTA from '@/components/OnboardingCTA'
import RecommendMorph from '@/components/RecommendMorph'
import TourSpotlight from '@/components/TourSpotlight'
import type { TourStep } from '@/lib/tour'
import {
  buildBubbles, buildCharacterLayer, buildGenreDetail, buildGhostLayer, buildGraph, buildStaffLayer, buildTimeline,
  filterByMedia, COVER_AUTO_LIMIT, DEFAULT_CONFIG,
  type FavChar, type GhostPick, type GraphConfig, type GraphNode, type MediaMode, type StaffRow,
} from '@/lib/graph-builder'
import GhostPanel from '@/components/GhostPanel'
import { useStatusLabel } from '@/components/useLabels'
import { STATUS_CSS_VARS } from '@/lib/status'
import type { ApiAnime, ApiFact } from '@/lib/types'

const CONFIG_KEY = 'anime-graph-config'
const VIEW_KEY = 'anime-graph-view'

const MEDIA_KEY = 'anime-graph-media'
const CHARS_KEY = 'anime-graph-chars'
const STAFF_KEY = 'anime-graph-staff'

const MEDIA_MODES = ['ANIME', 'MANGA', 'ALL'] as const satisfies readonly MediaMode[]

export default function GrafPage() {
  const [animeList, setAnimeList] = useState<ApiAnime[]>([])
  const [, setFacts] = useState<ApiFact[]>([])
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_CONFIG)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [flythrough, setFlythrough] = useState(0) // 0 = nem idővonal, timestamp = idővonal
  const [advanced, setAdvanced] = useState(false)
  const [focusGenre, setFocusGenre] = useState<string | null>(null)
  // lebego ajanlasok: a listan MEG NEM szereplo cimek, a graf szelen
  const [ghosts, setGhosts] = useState<GhostPick[]>([])
  const [openGhost, setOpenGhost] = useState<GraphNode | null>(null)
  const [fitKey, setFitKey] = useState(0)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [yearCutoff, setYearCutoff] = useState<number | null>(null) // null = teljes térkép
  const [mediaMode, setMediaMode] = useState<MediaMode>('ANIME')
  const t = useTranslations('graph')
  const tgl = useTranslations('graphLabels')
  const ts = useTranslations('status')
  const statusLabel = useStatusLabel()
  // A csoport-node felirata egyben az azonositoja is, ezert a forditott
  // cimkeket a builder KAPJA, nem a megjelenites teszi ra (lasd graph-builder).
  //
  // A memo STRINGEKRE fugg, nem a forditóra: a next-intl `t` minden renderben
  // uj referencia, igy az egesz grafot ujraepitene minden renderben.
  const lblUnknown = tgl('unknown')
  const lblNoScore = tgl('noScore')
  const lblWatching = ts('watching')
  const lblCompleted = ts('completed')
  const lblPlanned = ts('planned')
  const lblDropped = ts('dropped')
  const graphLabels = useMemo(() => ({
    unknown: lblUnknown,
    noScore: lblNoScore,
    status: {
      watching: lblWatching, completed: lblCompleted,
      planned: lblPlanned, dropped: lblDropped,
    },
  }), [lblUnknown, lblNoScore, lblWatching, lblCompleted, lblPlanned, lblDropped])
  // A tura-lepesek forditva keletkeznek, ezert a komponensen belul allnak.
  const GRAF_TOUR: TourStep[] = [
    { selector: 'graph', title: t('tour1Title'), text: t('tour1Text') },
    { selector: 'view-toggle', title: t('tour2Title'), text: t('tour2Text') },
    { selector: 'graph', title: t('tour3Title'), text: t('tour3Text') },
  ]
  const [showChars, setShowChars] = useState(false)
  const [favChars, setFavChars] = useState<FavChar[]>([])
  const [showStaff, setShowStaff] = useState(false)
  const [staffRows, setStaffRows] = useState<StaffRow[]>([])
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (saved) try { setConfig(JSON.parse(saved)) } catch { /* keep default */ }
    setAdvanced(localStorage.getItem(VIEW_KEY) === 'advanced')
    const savedMedia = localStorage.getItem(MEDIA_KEY)
    if (savedMedia === 'MANGA' || savedMedia === 'ALL') setMediaMode(savedMedia)
    setShowChars(localStorage.getItem(CHARS_KEY) === '1')
    setShowStaff(localStorage.getItem(STAFF_KEY) === '1')
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

  const loadGhosts = useCallback(() => {
    fetch('/api/graph/ghosts')
      .then((r) => (r.ok ? r.json() : { picks: [] }))
      .then((j) => setGhosts(j.picks ?? []))
      .catch(() => { /* ajanlasok nelkul is el a graf */ })
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { loadGhosts() }, [loadGhosts])

  // Felvettem: a cim mostantol a listan van, tehat nem lehet tobbe lebego ajanlas.
  const addGhost = useCallback(async (node: GraphNode) => {
    if (!node.anilistId) return
    const res = await fetch('/api/anime', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: node.anilistId, status: 'planned' }),
    })
    setGhosts((g) => g.filter((x) => x.anilistId !== node.anilistId))
    setOpenGhost(null)
    if (res.ok) refresh()
  }, [refresh])

  const dismissGhost = useCallback(async (node: GraphNode) => {
    if (!node.anilistId) return
    setGhosts((g) => g.filter((x) => x.anilistId !== node.anilistId))
    setOpenGhost(null)
    await fetch('/api/graph/ghosts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anilistId: node.anilistId }),
    }).catch(() => { /* a helyi eltuntetes igy is megtortent */ })
  }, [])

  // kedvenc karakterek a réteghez — csak bekapcsolt toggle-nál töltjük
  useEffect(() => {
    if (!showChars || favChars.length) return
    fetch('/api/characters/favorites')
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((j) => setFavChars(j.favorites ?? []))
      .catch(() => { /* réteg nélkül is él a gráf */ })
  }, [showChars, favChars.length])

  // rendezők a stáb-réteghez — csak bekapcsolt toggle-nál töltjük
  useEffect(() => {
    if (!showStaff || staffRows.length) return
    fetch('/api/staff')
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((j) => setStaffRows(j.staff ?? []))
      .catch(() => { /* réteg nélkül is él a gráf */ })
  }, [showStaff, staffRows.length])

  const timelineMode = flythrough !== 0

  // időutazás: csak az adott év végéig megnézett/felvett animék
  const watchYear = (a: ApiAnime) => new Date(a.watchedAt ?? a.createdAt).getFullYear()
  const minYear = useMemo(
    () => (animeList.length ? Math.min(...animeList.map(watchYear)) : new Date().getFullYear()),
    [animeList],
  )
  const maxYear = new Date().getFullYear()

  const rows = useMemo(() => filterByMedia(animeList, mediaMode)
    .filter((a) => yearCutoff == null || watchYear(a) <= yearCutoff)
    .map((a) => ({
      id: a.id, anilistId: a.anilistId, titleRomaji: a.titleRomaji,
      coverUrl: a.coverUrl, genres: a.genres, studio: a.studio, year: a.year,
      status: a.status, myScore: a.myScore, relations: a.relations,
      tags: a.tags, watchedAt: a.watchedAt, createdAt: a.createdAt,
    })), [animeList, yearCutoff, mediaMode])

  const graph = useMemo(() => {
    const base =
      timelineMode ? buildTimeline(rows)
      : advanced ? buildGraph(rows, config, graphLabels)
      : focusGenre ? buildGenreDetail(rows, focusGenre, graphLabels)
      : buildBubbles(rows, graphLabels)
    if ((!showChars && !showStaff) || timelineMode) return base
    // karakter/stáb-réteg: csak a most látható anime-node-okhoz kötve
    const visibleIds = new Set(
      base.nodes.filter((n) => n.type === 'anime' && n.animeId != null).map((n) => n.animeId!),
    )
    let merged = base
    if (showChars) {
      const layer = buildCharacterLayer(favChars, visibleIds)
      merged = { nodes: [...merged.nodes, ...layer.nodes], links: [...merged.links, ...layer.links] }
    }
    if (showStaff) {
      const layer = buildStaffLayer(staffRows, visibleIds)
      merged = { nodes: [...merged.nodes, ...layer.nodes], links: [...merged.links, ...layer.links] }
    }
    return merged
  }, [rows, config, timelineMode, advanced, focusGenre, showChars, favChars, showStaff, staffRows, graphLabels])

  // A ghostok a MOST lathato sajat cimekhez kotodnek, ezert a bazis-graf utan
  // szamolunk. Idovonal-modban kimaradnak: ott a pozicio datum szerint rogzitett,
  // egy nem-latott cimnek nincs hol allnia.
  const withGhosts = useMemo(() => {
    if (timelineMode || !ghosts.length) return graph
    const visibleIds = new Set(
      graph.nodes.filter((n) => n.type === 'anime' && n.animeId != null).map((n) => n.animeId!),
    )
    const visible = rows.filter((r) => visibleIds.has(r.id))
    const layer = buildGhostLayer(ghosts, visible)
    if (!layer.nodes.length) return graph
    return { nodes: [...graph.nodes, ...layer.nodes], links: [...graph.links, ...layer.links] }
  }, [graph, ghosts, rows, timelineMode])

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

  /* A lebegő kártya pozíciója NEM React-állapot.
     Korábban az onMouseMove a <main>-en setState-elt, tehát a teljes GrafPage
     fa — a ForceGraph3D részfájával együtt — mutató-ütemben (120Hz-es kijelzőn
     120/mp) rekonciliált, a kártya pedig `left`/`top`-pal helyeződött, és a
     render KÖZBEN olvasott window.innerWidth/Height-et. Az utóbbi kiüríti a
     függő layoutot, tehát minden mutató-esemény írás→olvasás→kényszerített
     layout ciklussá vált, ugyanabban a képkockában, amiben a WebGL-jelenet
     rajzolódik. Most: ref + egyszálú rAF + translate3d, compositoron. */
  const cardRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef(0)

  const writeCardPos = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`
  }, [])

  useEffect(() => {
    // a kártya mérete: a levágás a rAF-ben történik, nem renderben
    const CARD_W = 280
    const CARD_H = 180
    function onMove(e: PointerEvent) {
      posRef.current = {
        x: Math.max(0, Math.min(e.clientX + 18, window.innerWidth - CARD_W)),
        y: Math.max(0, Math.min(e.clientY + 18, window.innerHeight - CARD_H)),
      }
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        writeCardPos()
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [writeCardPos])

  const handleDimClick = useCallback((n: GraphNode) => {
    if (n.dim !== 'genre') return
    if (n.bubble) {
      setFocusGenre(n.label)
      setFitKey(Date.now())
    } else {
      setFocusGenre(null)
      setFitKey(Date.now())
    }
  }, [])

  if (!loaded) return null

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden">
      {/* fade+scale belepes a canvas KOROL — a Graph3D belso kameraja nem valtozik */}
      <motion.div
        data-tour="graph"
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={tweenFluid}
      >
        {/* A vászon önmagában elérhetetlen billentyűzetről: a raycasting
            egérre épül. A régió így legalább bejelentkezik és fókuszálható,
            a tartalma pedig valódi linkekként olvasható fel — a nyilas
            csomópont-léptetés külön munka (saját, node-hoz kötött
            kártyapozicionálást igényel). */}
        <div
          role="application"
          aria-label={t('ariaLabel')}
          tabIndex={0}
          className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <Graph3D
            data={withGhosts}
            onAnimeClick={openAnime}
            onAnimeHover={setHoverId}
            flythrough={flythrough}
            nodeMode={nodeMode}
            onDimClick={!advanced && !timelineMode ? handleDimClick : undefined}
            fitKey={fitKey}
            focusNodeId={focusNodeId}
            onGhostClick={setOpenGhost}
          />
        </div>
      </motion.div>

      {/* képernyőolvasós megfelelő: a térkép tartalma listaként, valódi linkekkel */}
      <nav className="sr-only" aria-label={t('nodeListLabel')}>
        <ul>
          {graph.nodes
            .filter((n) => n.type === 'anime' && n.animeId != null)
            .map((n) => (
              <li key={n.id}>
                <Link href={`/anime/${n.animeId}`}>{n.label}</Link>
              </li>
            ))}
        </ul>
      </nav>

      {/* Kereső és „Ajánlj nekem" EGY sorban osztozik. Külön fixed elemként
          390px-en egymásra csúsztak (x 234–336 átfedés). Desktopon a
          justify-between visszateszi őket a két sarokba. */}
      <div className="fixed top-20 left-4 right-4 z-20 flex items-start justify-between gap-2 pointer-events-none">
        <div className="min-w-0 flex-1 pointer-events-auto md:max-w-sm">
          <AddAnimeSearch onAdded={handleAdded} ownList={animeList} onPickOwn={flyToAnime} />
        </div>
        <div className="shrink-0 pointer-events-auto">
          <RecommendMorph onAdded={refresh} />
        </div>
      </div>

      {/* breadcrumb a drill-down nézetben */}
      {!advanced && !timelineMode && focusGenre && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => { setFocusGenre(null); setFitKey(Date.now()) }}
            className="surface-overlay rounded-full px-4 py-2 text-sm text-text-1 hover:bg-white/10 transition-colors"
          >
            {t('allGenres')}
            <span className="label-mono ml-2">{focusGenre} · {animeNodeCount}</span>
          </button>
        </div>
      )}

      {/* Alsó vezérlők EGY konténerben. Korábban a gombsor és az időutazás-
          csúszka két külön fixed elem volt azonos bottom-értékkel: 390px-en
          a gombsor 592px-re nőtt (kilógott), és rácsúszott a csúszkára.
          Mobilon egymás alá kerülnek, a gombsor vízszintesen görgethető. */}
      <div className="fixed bottom-24 md:bottom-4 left-0 right-0 z-20 flex flex-col gap-2 px-4 pointer-events-none md:flex-row md:items-end md:justify-between">
        {/* overscroll-x contain: vízszintes flingnél eddig a böngésző
            vissza-gesztusa sült el a sáv végén (§9) */}
        <div className="-mx-4 flex items-end gap-2 overflow-x-auto overscroll-x-contain px-4 no-scrollbar pointer-events-auto md:mx-0 md:overflow-visible md:px-0">
        {advanced && !timelineMode && <HierarchyPanel config={config} onChange={updateConfig} />}
        <div className="surface-overlay rounded-full p-1 flex shrink-0">
          {MEDIA_MODES.map((m) => (
            <button
              key={m}
              onClick={() => {
                setMediaMode(m)
                localStorage.setItem(MEDIA_KEY, m)
                setFocusGenre(null)
                setFitKey(Date.now())
              }}
              className={`rounded-full px-3 py-2 text-xs text-text-2 transition-colors ${
                mediaMode === m ? 'bg-white/15 !text-text-1' : 'hover:bg-white/10'
              }`}
            >
              {t(`media_${m}`)}
            </button>
          ))}
        </div>
        {!timelineMode && (
          <button
            data-tour="view-toggle"
            onClick={() => setView(!advanced)}
            className="surface-overlay shrink-0 rounded-full px-4 py-2.5 text-xs text-text-2 hover:text-text-1 transition-colors"
          >
            {advanced ? t('simpleView') : t('advancedView')}
          </button>
        )}
        <button
          onClick={() => setFlythrough(timelineMode ? 0 : Date.now())}
          className={`surface-overlay shrink-0 rounded-full px-4 py-2.5 text-xs text-text-2 transition-colors ${
            timelineMode ? 'bg-white/15 !text-text-1' : 'hover:bg-white/10'
          }`}
        >
          {timelineMode ? t('timelineOff') : t('timeline')}
        </button>
        {!timelineMode && (
          <button
            onClick={() => {
              const next = !showChars
              setShowChars(next)
              localStorage.setItem(CHARS_KEY, next ? '1' : '0')
            }}
            title={t('charactersTooltip')}
            className={`surface-overlay shrink-0 rounded-full px-4 py-2.5 text-xs text-text-2 transition-colors ${
              showChars ? 'bg-white/15 !text-text-1' : 'hover:bg-white/10'
            }`}
          >
            {t('characters')}
          </button>
        )}
        {!timelineMode && (
          <button
            onClick={() => {
              const next = !showStaff
              setShowStaff(next)
              localStorage.setItem(STAFF_KEY, next ? '1' : '0')
            }}
            title={t('staffTooltip')}
            className={`surface-overlay shrink-0 rounded-full px-4 py-2.5 text-xs text-text-2 transition-colors ${
              showStaff ? 'bg-white/15 !text-text-1' : 'hover:bg-white/10'
            }`}
          >
            {t('staff')}
          </button>
        )}
        </div>

      {/* időutazás: így nőtt az univerzumod évről évre.
          Ugyanabban a konténerben, mint a gombsor — mobilon alá kerül,
          desktopon a jobb szélre. Korábban külön fixed elem volt azonos
          bottom-értékkel, ezért rácsúszott a gombsorra. */}
      {!timelineMode && minYear < maxYear && (
        <div className="surface-overlay pointer-events-auto flex shrink-0 items-center gap-3 self-start rounded-full px-4 py-2.5 md:self-end">
          <span className="label-mono">{t('timeTravel')}</span>
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
      </div>

      {animeList.length === 0 && (
        <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-lg w-full px-4">
            <OnboardingCTA />
          </div>
        </div>
      )}

      {/* első látogatás: oldalankénti spotlight-túra (a régi hint-sávot váltja) */}
      {openGhost && (
        <GhostPanel
          node={openGhost}
          onAdd={() => addGhost(openGhost)}
          onDismiss={() => dismissGhost(openGhost)}
          onClose={() => setOpenGhost(null)}
        />
      )}

      {animeList.length > 0 && <TourSpotlight page="graf" steps={GRAF_TOUR} />}

      {hoverAnime && (
        <div
          ref={cardRef}
          className="surface-overlay fixed left-0 top-0 z-30 w-64 rounded-2xl p-3 pointer-events-none flex gap-3"
          style={{
            // a felcsatoláskori pozíció; onnantól a rAF írja közvetlenül
            transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
            willChange: 'transform',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {hoverAnime.coverUrl && <img src={hoverAnime.coverUrl} alt="" className="w-14 rounded-lg self-start" />}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{hoverAnime.titleRomaji}</p>
            {hoverAnime.titleNative && (
              <p className="text-11 text-micro text-text-3 leading-tight mt-0.5">{hoverAnime.titleNative}</p>
            )}
            <p className="label-mono mt-1.5">
              {hoverAnime.year ?? '?'} · {hoverAnime.format ?? '?'} ·{' '}
              {t('episodeCount', { count: hoverAnime.episodes ?? '?' })}
            </p>
            <p className="flex items-center gap-1.5 mt-1.5 text-xs text-text-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${hoverAnime.status === 'watching' ? 'animate-pulse' : ''}`}
                style={{ background: STATUS_CSS_VARS[hoverAnime.status] ?? 'white' }}
              />
              {statusLabel(hoverAnime.status)}
              {hoverAnime.myScore != null && <span className="text-text-3">· {hoverAnime.myScore}/10</span>}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
