'use client'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import type { GraphNode, GraphLink } from '@/lib/graph-builder'

// dynamic() drops refs, so wrap and pass the ref as a normal prop
const ForceGraph3D = dynamic(
  () => import('react-force-graph-3d').then((m) => {
    const FG = m.default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Wrapper = ({ fgRef, ...props }: any) => <FG ref={fgRef} {...props} />
    return Wrapper
  }),
  { ssr: false },
)

const STATUS_DOT: Record<string, number> = {
  completed: 0xfafafa,
  watching: 0x8ce0b0,
  planned: 0x8a8f98,
  dropped: 0xe08c8c,
}

// AniList CDN sends no CORS headers → covers go through the Next image proxy

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// per-size caches: texture AND material shared across node-object rebuilds
const coverTexCache = new Map<string, THREE.CanvasTexture>()
const coverMatCache = new Map<string, THREE.SpriteMaterial>()

function coverTexture(url: string, lite: boolean): THREE.CanvasTexture {
  const key = `${lite ? 'l' : 'f'}|${url}`
  const cached = coverTexCache.get(key)
  if (cached) return cached
  const W = lite ? 48 : 96
  const H = lite ? 66 : 132
  const R = lite ? 6 : 12
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRectPath(ctx, 0, 0, W, H, R)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    roundRectPath(ctx, 0, 0, W, H, R)
    ctx.clip()
    ctx.drawImage(img, 0, 0, W, H)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = lite ? 1.5 : 2
    roundRectPath(ctx, 1, 1, W - 2, H - 2, R)
    ctx.stroke()
    tex.needsUpdate = true
  }
  img.src = `/_next/image?url=${encodeURIComponent(url)}&w=${lite ? 64 : 128}&q=${lite ? 60 : 70}`
  coverTexCache.set(key, tex)
  return tex
}

function coverMaterial(url: string, lite: boolean): THREE.SpriteMaterial {
  const key = `${lite ? 'l' : 'f'}|${url}`
  let mat = coverMatCache.get(key)
  if (!mat) {
    mat = new THREE.SpriteMaterial({ map: coverTexture(url, lite), transparent: true })
    coverMatCache.set(key, mat)
  }
  return mat
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// shared geometry/materials: with hundreds of nodes, per-node allocations kill the GPU
const DOT_GEO = new THREE.SphereGeometry(1.4, 8, 8)
const DOT_GEO_BIG = new THREE.SphereGeometry(2.6, 10, 10)
const DOT_GEO_MID = new THREE.SphereGeometry(1.9, 8, 8)
const STATUS_MATERIALS = new Map<string, THREE.MeshBasicMaterial>(
  Object.entries(STATUS_DOT).map(([s, c]) => [s, new THREE.MeshBasicMaterial({ color: c })]),
)
const GENRE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
const DIM_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })

export type NodeMode = 'full' | 'lite' | 'dot'

// anime node: cover + status dot always; 'full' adds the name label,
// 'lite' uses a smaller texture and no text (name lives on the hover card),
// 'dot' is the bare fallback for weak machines
function animeObject(node: GraphNode, mode: NodeMode): THREE.Object3D {
  const material = STATUS_MATERIALS.get(node.status ?? 'planned') ?? STATUS_MATERIALS.get('completed')!
  const dot = new THREE.Mesh(DOT_GEO, material)
  if (mode === 'dot' || !node.img) {
    if (mode !== 'dot' && !node.img) {
      // no cover available → at least show the name so the node stays identifiable
      const group = new THREE.Group()
      group.add(dot)
      const name = new SpriteText(truncate(node.label, 24), 2.6, '#d9d9df')
      name.fontFace = 'Instrument Sans, Arial'
      name.position.set(0, 4.6, 0)
      group.add(name)
      return group
    }
    return dot
  }

  const group = new THREE.Group()
  group.add(dot)

  const lite = mode === 'lite'
  const cover = new THREE.Sprite(coverMaterial(node.img, lite))
  if (lite) {
    cover.scale.set(7, 9.6, 1)
    cover.position.set(0, 7.4, 0)
  } else {
    cover.scale.set(10, 13.75, 1)
    cover.position.set(0, 14.2, 0)
  }
  group.add(cover)

  if (!lite) {
    const name = new SpriteText(truncate(node.label, 24), 2.6, '#d9d9df')
    name.fontFace = 'Instrument Sans, Arial'
    name.position.set(0, 4.6, 0)
    group.add(name)
  }
  return group
}

// timeline year marker: big mono year, no dot
function timeObject(node: GraphNode): THREE.Object3D {
  const label = new SpriteText(node.label, 7, 'rgba(250,250,250,0.55)')
  label.fontFace = 'Geist Mono, monospace'
  return label
}

// dimension node: name above a plain white dot (genre reads bigger than studio/year/…)
function dimObject(node: GraphNode): THREE.Object3D {
  if (node.timeNode) return timeObject(node)
  const group = new THREE.Group()
  const isGenre = node.dim === 'genre'
  const dot = new THREE.Mesh(isGenre ? DOT_GEO_BIG : DOT_GEO_MID, isGenre ? GENRE_MAT : DIM_MAT)
  group.add(dot)
  const label = new SpriteText(node.label, isGenre ? 3.6 : 2.9, isGenre ? '#fafafa' : '#b9b9c1')
  label.fontFace = 'Instrument Sans, Arial'
  label.position.set(0, isGenre ? 6 : 5, 0)
  group.add(label)
  return group
}

export default function Graph3D({
  data,
  onAnimeClick,
  onAnimeHover,
  flythrough = 0,
  nodeMode = 'full',
}: {
  data: { nodes: GraphNode[]; links: GraphLink[] }
  onAnimeClick: (animeId: number) => void
  onAnimeHover: (animeId: number | null) => void
  // timestamp trigger: when it changes to a non-zero value, the camera
  // flies along the pinned x axis from the earliest to the latest node
  flythrough?: number
  nodeMode?: NodeMode
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  useEffect(() => {
    if (!flythrough) return
    // the ref only exposes camera methods, so the axis range comes from props
    const xs = data.nodes
      .filter((n) => n.type === 'anime' && n.fx !== undefined)
      .map((n) => n.fx as number)
    if (!xs.length) return
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const duration = Math.min(14000, Math.max(4000, xs.length * 700))
    const timer = setInterval(() => {
      const fg = fgRef.current
      if (!fg) return
      clearInterval(timer)
      fg.cameraPosition({ x: minX - 30, y: 14, z: 105 }, { x: minX, y: 0, z: 0 }, 0)
      setTimeout(() => {
        fg.cameraPosition({ x: maxX + 30, y: 14, z: 105 }, { x: maxX, y: 0, z: 0 }, duration)
      }, 700)
    }, 150)
    return () => clearInterval(timer)
  }, [flythrough, data])

  // clone: force-graph mutates node objects (adds x/y/z)
  const graphData = useMemo(() => ({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  }), [data])

  // stable prop identities: the underlying lib re-applies changed props on every
  // React re-render, so inline closures would rebuild all node objects constantly
  const nodeThreeObject = useCallback(
    (n: GraphNode) => (n.type === 'anime' ? animeObject(n, nodeMode) : dimObject(n)),
    [nodeMode],
  )
  const nodeLabel = useCallback(() => '', [])
  const linkColor = useCallback(
    (l: GraphLink) => (l.kind === 'relation' ? '#ffffff' : '#8f8f96'),
    [],
  )
  const linkLineDash = useCallback(
    (l: GraphLink) => (l.kind === 'relation' ? [3, 2] : null),
    [],
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((n: any) => {
    if (n.type === 'anime' && n.animeId) {
      onAnimeClick(n.animeId)
      return
    }
    const dist = 80
    const len = Math.hypot(n.x, n.y, n.z) || 1
    const ratio = 1 + dist / len
    fgRef.current?.cameraPosition(
      { x: n.x * ratio, y: n.y * ratio, z: n.z * ratio },
      n,
      1000,
    )
  }, [onAnimeClick])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((n: any) => {
    onAnimeHover(n?.type === 'anime' ? n.animeId ?? null : null)
    document.body.style.cursor = n?.type === 'anime' ? 'pointer' : 'default'
  }, [onAnimeHover])

  return (
    <ForceGraph3D
      fgRef={fgRef}
      graphData={graphData}
      backgroundColor="rgba(0,0,0,0)"
      nodeThreeObject={nodeThreeObject}
      nodeLabel={nodeLabel}
      cooldownTime={8000}
      linkColor={linkColor}
      linkOpacity={0.28}
      linkWidth={0}
      linkLineDash={linkLineDash}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
    />
  )
}
