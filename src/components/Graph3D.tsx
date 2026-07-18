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

const STATUS_TINT: Record<string, number> = {
  completed: 0xffffff,
  watching: 0xffffff,
  planned: 0x8899aa,
  dropped: 0x555555,
}

const texLoader = new THREE.TextureLoader()
texLoader.setCrossOrigin('anonymous')
const texCache = new Map<string, THREE.Texture>()

function animeObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const size = Math.max(6, Math.min(16, node.val * 1.5))
  if (node.img) {
    let tex = texCache.get(node.img)
    if (!tex) {
      tex = texLoader.load(node.img)
      texCache.set(node.img, tex)
    }
    const mat = new THREE.SpriteMaterial({ map: tex })
    mat.color.setHex(STATUS_TINT[node.status ?? 'planned'] ?? 0xffffff)
    const sprite = new THREE.Sprite(mat)
    sprite.scale.set(size * 0.7, size, 1)
    group.add(sprite)
  } else {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size / 3),
      new THREE.MeshLambertMaterial({ color: 0x66ddff }),
    )
    group.add(mesh)
  }
  if (node.status === 'watching') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.55, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x22ffcc }),
    )
    group.add(ring)
  }
  return group
}

function dimObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(3),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
  )
  const label = new SpriteText(node.label, 4, '#bae6fd')
  label.position.set(0, 6, 0)
  group.add(sphere, label)
  return group
}

export default function Graph3D({
  data,
  onAnimeClick,
  focusNodeId,
}: {
  data: { nodes: GraphNode[]; links: GraphLink[] }
  onAnimeClick: (animeId: number) => void
  focusNodeId: string | null
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  // clone: force-graph mutates node objects (adds x/y/z)
  const graphData = useMemo(() => ({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  }), [data])

  // bloom pass, added once the underlying lib instance exists
  useEffect(() => {
    const timer = setInterval(() => {
      const fg = fgRef.current
      if (!fg) return
      clearInterval(timer)
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js').then(({ UnrealBloomPass }) => {
        const pass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.1, 0.5, 0.15)
        fg.postProcessingComposer().addPass(pass)
      })
    }, 200)
    return () => clearInterval(timer)
  }, [])

  // fly to a node when asked (search hit / external focus)
  useEffect(() => {
    if (!focusNodeId || !fgRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = fgRef.current.graphData().nodes.find((n: any) => n.id === focusNodeId)
    if (!node || node.x === undefined) return
    flyTo(node)
  }, [focusNodeId])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function flyTo(node: any) {
    const dist = 70
    const len = Math.hypot(node.x, node.y, node.z) || 1
    const ratio = 1 + dist / len
    fgRef.current.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      node,
      1200,
    )
  }

  return (
    <ForceGraph3D
      fgRef={fgRef}
      graphData={graphData}
      backgroundColor="#04060f"
      nodeThreeObject={(n: GraphNode) => (n.type === 'anime' ? animeObject(n) : dimObject(n))}
      nodeLabel={(n: GraphNode) => n.label}
      linkColor={(l: GraphLink) => (l.kind === 'relation' ? '#f472b6' : '#334155')}
      linkOpacity={0.5}
      linkWidth={(l: GraphLink) => (l.kind === 'relation' ? 1.5 : 0.5)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeClick={(n: any) => {
        flyTo(n)
        if (n.type === 'anime' && n.animeId) onAnimeClick(n.animeId)
      }}
    />
  )
}
