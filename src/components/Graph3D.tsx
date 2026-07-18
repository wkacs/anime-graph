'use client'
import { useEffect, useMemo, useRef } from 'react'
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
const proxied = (url: string) => `/_next/image?url=${encodeURIComponent(url)}&w=128&q=70`

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const coverTexCache = new Map<string, THREE.CanvasTexture>()

function coverTexture(url: string): THREE.CanvasTexture {
  const cached = coverTexCache.get(url)
  if (cached) return cached
  const W = 96, H = 132, R = 12
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
    ctx.lineWidth = 2
    roundRectPath(ctx, 1, 1, W - 2, H - 2, R)
    ctx.stroke()
    tex.needsUpdate = true
  }
  img.src = proxied(url)
  coverTexCache.set(url, tex)
  return tex
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// anime node: cover on top, name below it, white status dot at the link anchor
function animeObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const color = STATUS_DOT[node.status ?? 'planned'] ?? 0xfafafa
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 16, 16),
    new THREE.MeshBasicMaterial({ color }),
  )
  group.add(dot)

  const name = new SpriteText(truncate(node.label, 24), 2.6, '#d9d9df')
  name.fontFace = 'Instrument Sans, Arial'
  name.position.set(0, 4.6, 0)
  group.add(name)

  if (node.img) {
    const mat = new THREE.SpriteMaterial({ map: coverTexture(node.img), transparent: true })
    const cover = new THREE.Sprite(mat)
    cover.scale.set(10, 13.75, 1)
    cover.position.set(0, 14.2, 0)
    group.add(cover)
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
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(isGenre ? 2.6 : 1.9, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: isGenre ? 0.95 : 0.75 }),
  )
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
}: {
  data: { nodes: GraphNode[]; links: GraphLink[] }
  onAnimeClick: (animeId: number) => void
  onAnimeHover: (animeId: number | null) => void
  // timestamp trigger: when it changes to a non-zero value, the camera
  // flies along the pinned x axis from the earliest to the latest node
  flythrough?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  useEffect(() => {
    if (!flythrough) return
    const timer = setInterval(() => {
      const fg = fgRef.current
      if (!fg) return
      clearInterval(timer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodes = fg.graphData().nodes.filter((n: any) => n.type === 'anime' && n.fx !== undefined)
      if (!nodes.length) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const xs = nodes.map((n: any) => n.fx as number)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      fg.cameraPosition({ x: minX - 30, y: 14, z: 105 }, { x: minX, y: 0, z: 0 }, 0)
      const duration = Math.min(14000, Math.max(4000, nodes.length * 700))
      setTimeout(() => {
        fg.cameraPosition({ x: maxX + 30, y: 14, z: 105 }, { x: maxX, y: 0, z: 0 }, duration)
      }, 700)
    }, 150)
    return () => clearInterval(timer)
  }, [flythrough])

  // clone: force-graph mutates node objects (adds x/y/z)
  const graphData = useMemo(() => ({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  }), [data])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function flyTo(node: any) {
    const dist = 80
    const len = Math.hypot(node.x, node.y, node.z) || 1
    const ratio = 1 + dist / len
    fgRef.current.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      node,
      1000,
    )
  }

  return (
    <ForceGraph3D
      fgRef={fgRef}
      graphData={graphData}
      backgroundColor="rgba(0,0,0,0)"
      nodeThreeObject={(n: GraphNode) => (n.type === 'anime' ? animeObject(n) : dimObject(n))}
      nodeLabel={() => ''}
      linkColor={(l: GraphLink) => (l.kind === 'relation' ? '#ffffff' : '#8f8f96')}
      linkOpacity={0.28}
      linkWidth={0}
      linkLineDash={(l: GraphLink) => (l.kind === 'relation' ? [3, 2] : null)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeClick={(n: any) => {
        if (n.type === 'anime' && n.animeId) onAnimeClick(n.animeId)
        else flyTo(n)
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeHover={(n: any) => {
        onAnimeHover(n?.type === 'anime' ? n.animeId ?? null : null)
        document.body.style.cursor = n?.type === 'anime' ? 'pointer' : 'default'
      }}
    />
  )
}
