'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion } from 'framer-motion'
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

// favorite character: small portrait sprite + name, CV in a fainter line below
function charObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const dot = new THREE.Mesh(DOT_GEO, DIM_MAT)
  group.add(dot)
  if (node.img) {
    const portrait = new THREE.Sprite(coverMaterial(node.img, true))
    portrait.scale.set(5, 6.9, 1)
    portrait.position.set(0, 5.4, 0)
    group.add(portrait)
  }
  const name = new SpriteText(truncate(node.label, 20), 2.2, '#d9d9df')
  name.fontFace = 'Instrument Sans, Arial'
  name.position.set(0, -3.6, 0)
  group.add(name)
  if (node.sub) {
    const cv = new SpriteText(`CV: ${truncate(node.sub, 22)}`, 1.7, '#8a8f98')
    cv.fontFace = 'Instrument Sans, Arial'
    cv.position.set(0, -6.2, 0)
    group.add(cv)
  }
  return group
}

// timeline year marker: big mono year, no dot
function timeObject(node: GraphNode): THREE.Object3D {
  const label = new SpriteText(node.label, 7, 'rgba(250,250,250,0.55)')
  label.fontFace = 'Geist Mono, monospace'
  return label
}

const BUBBLE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 16)

// drill-down entry: genre bubble, radius grows with the anime count,
// topped with the genre's best covers as a small collage
function bubbleObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const r = Math.min(16, 4 + Math.sqrt(node.val) * 2.2)
  const sphere = new THREE.Mesh(UNIT_SPHERE, BUBBLE_MAT)
  sphere.scale.setScalar(r)
  group.add(sphere)

  const covers = node.covers ?? []
  const fan = covers.length === 1 ? [0] : covers.length === 2 ? [-4.5, 4.5] : [-7.5, 0, 7.5]
  covers.forEach((url, i) => {
    const sprite = new THREE.Sprite(coverMaterial(url, true))
    sprite.scale.set(6.4, 8.8, 1)
    sprite.position.set(fan[i], r + 6.5 + (fan[i] === 0 ? 2.2 : 0), 0)
    group.add(sprite)
  })

  const label = new SpriteText(`${node.label} · ${node.val}`, 4.4, '#fafafa')
  label.fontFace = 'Instrument Sans, Arial'
  label.position.set(0, -(r + 5), 0)
  group.add(label)
  return group
}

// A ghost SOSEM nezhet ki listas cimnek: nincs statusz-szine, a boritoja halvany,
// es egy nyitott gyuru jelzi, hogy meg nem a tied. Ha ugyanugy nezne ki, a graf
// hazudna arrol, mit lattal mar.
const GHOST_RING_GEO = new THREE.TorusGeometry(2.2, 0.28, 8, 24)
const GHOST_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })

function ghostObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  group.add(new THREE.Mesh(GHOST_RING_GEO, GHOST_MAT))
  if (node.img) {
    // KLONOZVA: a coverMaterial cache-elt es megosztott — az opacity kozvetlen
    // irasa minden mas node boritojat is elhalvanyitana. Ghostbol max 5 van, a
    // par extra material nem szamit.
    const cover = new THREE.Sprite(coverMaterial(node.img, true).clone())
    cover.material.opacity = 0.55
    cover.scale.set(6, 8.2, 1)
    cover.position.set(0, 7.6, 0)
    group.add(cover)
  }
  const name = new SpriteText(truncate(node.label, 22), 2.4, '#9a9aa4')
  name.fontFace = 'Instrument Sans, Arial'
  name.position.set(0, 4.4, 0)
  group.add(name)
  return group
}

// dimension node: name above a plain white dot (genre reads bigger than studio/year/…)
function dimObject(node: GraphNode): THREE.Object3D {
  if (node.timeNode) return timeObject(node)
  if (node.bubble) return bubbleObject(node)
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
  onDimClick,
  fitKey = 0,
  focusNodeId = null,
  onGhostClick,
}: {
  data: { nodes: GraphNode[]; links: GraphLink[] }
  onAnimeClick: (animeId: number) => void
  onAnimeHover: (animeId: number | null) => void
  // timestamp trigger: when it changes to a non-zero value, the camera
  // flies along the pinned x axis from the earliest to the latest node
  flythrough?: number
  nodeMode?: NodeMode
  // drill-down: dimension-node click (bubble or hub); fallback is a camera fly-to
  onDimClick?: (node: GraphNode) => void
  // when it changes, the camera re-fits the whole graph
  fitKey?: number
  // fly to this node once the layout has placed it (e.g. a freshly added anime)
  focusNodeId?: string | null
  // lebego ajanlas kattintasa — a hivo nyitja ra a dontesi panelt
  onGhostClick?: (node: GraphNode) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)
  const introDone = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoveredRef = useRef<any>(null)

  // A ref MEGÉRKEZÉSE eddig setInterval-lel volt kipollozva (120/150/350ms-os
  // ciklusok), és a kamera-illesztés mögé még egy 450ms-os kemény időzítő is
  // került — kattintás után ~600ms holt idő telt el, mielőtt bármi mozdult
  // volna (§1: „minden mesterséges időzítőt auditálj"). Callback-ref: a
  // példány érkezésének pillanatában billen a kapcsoló.
  const [ready, setReady] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachFg = useCallback((inst: any) => {
    fgRef.current = inst
    if (inst) setReady(true)
  }, [])

  // A gráf a lap egyetlen teljes-viewportos, folyamatosan mozgó felülete —
  // pontosan az az eset, amit a §14 néven nevez. A CSS-őr ide nem ér el:
  // ez WebGL + rAF.
  const reduce = !!useReducedMotion()
  /** kamerarepülés hossza; csökkentett mozgásnál vágás, nem utazás */
  const dur = useCallback((ms: number) => (reduce ? 0 : ms), [reduce])

  // WASD (+ Q/E fel-le) repülés: a kamera ÉS az orbit-pivot együtt mozog,
  // így az egeres forgatás közben is működik. Gépelés közben inaktív.
  useEffect(() => {
    const pressed = new Set<string>()
    const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e'])
    const isTyping = () => {
      const el = document.activeElement
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    }
    const down = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase()
      if (MOVE_KEYS.has(k) && !isTyping()) pressed.add(k)
    }
    const up = (ev: KeyboardEvent) => pressed.delete(ev.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)

    let raf = 0
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const delta = new THREE.Vector3()
    const vel = new THREE.Vector3()
    const UP = new THREE.Vector3(0, 1, 0)

    // A mozgás ÓRÁHOZ kötött és van tehetetlensége. Korábban képkockánként fix
    // 3,2 egységet lépett: 144Hz-en két és félszer gyorsabb volt, mint 60-on,
    // induláskor-megálláskor pedig keményen vágott (§4: a felhasználó által
    // hajtott mozgás sose legyen előírt lépés; §5: a sebesség folytonos).
    const ACCEL = 600
    const MAX_SPEED = 320
    let last = performance.now()

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      // háttérbe tett fülnél a dt elszállna és a kamera teleportálna
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // se gomb, se maradék lendület → nincs mit számolni
      if (!pressed.size && vel.lengthSq() < 0.01) return
      const fg = fgRef.current
      if (!fg) return
      const camera = fg.camera()
      const controls = fg.controls()
      camera.getWorldDirection(forward)
      right.crossVectors(forward, UP).normalize()
      dir.set(0, 0, 0)
      if (pressed.has('w')) dir.add(forward)
      if (pressed.has('s')) dir.sub(forward)
      if (pressed.has('d')) dir.add(right)
      if (pressed.has('a')) dir.sub(right)
      if (pressed.has('e')) dir.add(UP)
      if (pressed.has('q')) dir.sub(UP)
      if (dir.lengthSq() > 0) {
        dir.normalize()
        vel.addScaledVector(dir, ACCEL * dt)
        vel.clampLength(0, MAX_SPEED)
      }
      // exponenciális csillapítás: elengedéskor kigurul, nem áll meg falba
      vel.multiplyScalar(Math.pow(0.0025, dt))
      delta.copy(vel).multiplyScalar(dt)
      camera.position.add(delta)
      if (controls?.target) {
        controls.target.add(delta)
        controls.update?.()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // ambient starfield + first-load camera dive
  useEffect(() => {
    if (!ready || !data.nodes.length) return
    const fg = fgRef.current
    if (!fg) return
    let dive = 0
    // zoom a kurzor iránya felé, ne a scéna közepe felé (three r149+ natív)
    const controls = fg.controls() as { zoomToCursor?: boolean }
    if (controls) controls.zoomToCursor = true
    const scene = fg.scene()
    if (!scene.getObjectByName('starfield')) {
      const N = 700
      const positions = new Float32Array(N * 3)
      for (let i = 0; i < N; i++) {
        const r = 600 + Math.random() * 900
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffffff, size: 1.5, transparent: true, opacity: 0.32, sizeAttenuation: true,
      }))
      stars.name = 'starfield'
      scene.add(stars)
    }
    if (!introDone.current) {
      introDone.current = true
      if (reduce) {
        // csökkentett mozgás: nincs bezuhanás, azonnal a kész kép
        fg.zoomToFit(0, 80)
      } else {
        fg.cameraPosition({ x: 0, y: 40, z: 1150 }, { x: 0, y: 0, z: 0 }, 0)
        // az időzítő ID-je EL VAN KAPVA: unmountnál eddig elszabadult
        dive = window.setTimeout(() => fg.zoomToFit(1500, 80), 450)
      }
    }
    return () => window.clearTimeout(dive)
  }, [ready, data, reduce])

  useEffect(() => {
    if (!ready || !flythrough) return
    const fg = fgRef.current
    if (!fg) return
    // the ref only exposes camera methods, so the axis range comes from props
    const xs = data.nodes
      .filter((n) => n.type === 'anime' && n.fx !== undefined)
      .map((n) => n.fx as number)
    if (!xs.length) return
    if (reduce) {
      fg.zoomToFit(0, 80)
      return
    }
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)

    // A tempó a TÁVOLSÁGBÓL jön, nem az elemszámból, és a kamera a
    // távolsággal hátrébb megy. Korábban a táv (N-1)*42 szerint korlátlanul
    // nőtt, az idő viszont 14000ms-nál meg volt fogva: 500 címnél ~50 egység
    // per képkocka, 10 egység széles poszterek mellett — minden borító
    // kevesebb mint egy képkockáig látszott (§11: strobszkóp-hatás).
    // Így a LÁTÓSZÖGBEN mért haladás marad állandó, könyvtármérettől
    // függetlenül.
    const span = Math.max(1, maxX - minX)
    const z = Math.max(105, span / 24)
    const ANGULAR = 1.714
    const duration = Math.max(4000, Math.min(16000, (span / (ANGULAR * z)) * 1000))

    fg.cameraPosition({ x: minX - 30, y: 14, z }, { x: minX, y: 0, z: 0 }, 0)
    // az ID EL VAN KAPVA: a Timeline 700ms-on belüli kikapcsolása után eddig
    // is elsült a kameraugrás, mert a takarítás csak az intervallumot vitte
    const jump = window.setTimeout(() => {
      fg.cameraPosition({ x: maxX + 30, y: 14, z }, { x: maxX, y: 0, z: 0 }, duration)
    }, 700)
    return () => window.clearTimeout(jump)
  }, [ready, flythrough, data, reduce])

  // clone: force-graph mutates node objects (adds x/y/z)
  const graphData = useMemo(() => ({
    nodes: data.nodes.map((n) => ({ ...n })),
    links: data.links.map((l) => ({ ...l })),
  }), [data])

  // stable prop identities: the underlying lib re-applies changed props on every
  // React re-render, so inline closures would rebuild all node objects constantly
  const nodeThreeObject = useCallback(
    (n: GraphNode) =>
      n.type === 'anime' ? animeObject(n, nodeMode)
      : n.type === 'char' ? charObject(n)
      : n.type === 'ghost' ? ghostObject(n)
      : dimObject(n),
    [nodeMode],
  )
  const nodeLabel = useCallback(() => '', [])
  const linkColor = useCallback(
    (l: GraphLink) =>
      l.kind === 'relation' ? '#ffffff'
      : l.kind === 'ghost' ? '#6f6f7a'
      : l.kind === 'vibe' || l.kind === 'seiyuu' ? '#5c5c66'
      : '#8f8f96',
    [],
  )
  const linkLineDash = useCallback(
    (l: GraphLink) =>
      l.kind === 'relation' ? [3, 2]
      // a ghost-el hosszabb szaggatassal: „ide vezet at, de meg nem lepted meg"
      : l.kind === 'ghost' ? [2, 4]
      : l.kind === 'vibe' || l.kind === 'seiyuu' ? [1.5, 3.5]
      : null,
    [],
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((n: any) => {
    if (n.type === 'anime' && n.animeId) {
      onAnimeClick(n.animeId)
      return
    }
    if (onGhostClick && n.type === 'ghost') {
      onGhostClick(n as GraphNode)
      return
    }
    if (onDimClick && n.type === 'dim' && !n.timeNode) {
      onDimClick(n as GraphNode)
      return
    }
    const dist = 80
    const len = Math.hypot(n.x, n.y, n.z) || 1
    const ratio = 1 + dist / len
    // 1000ms → 400ms: ez interaktív válasz, nem filmes beállítás, tehát a
    // 0,3-0,4s-os sávba tartozik
    fgRef.current?.cameraPosition(
      { x: n.x * ratio, y: n.y * ratio, z: n.z * ratio },
      n,
      dur(400),
    )
  }, [onAnimeClick, onDimClick, onGhostClick, dur])

  useEffect(() => {
    if (!ready || !fitKey) return
    const fg = fgRef.current
    if (!fg) return
    // A 450ms-os kemény várakozás törölve: a 700ms-os illesztés MAGA a
    // beállási ablak, és folyamatosan újracéloz, mert a layout még ketyeg.
    fg.zoomToFit(dur(700), 70)
  }, [ready, fitKey, dur])

  // fly to a freshly added node: the lib mutates our cloned graphData in place,
  // so its coordinates show up right here once the layout picked it up.
  // The layout keeps moving for seconds after a rebuild — flying too early
  // aims at a stale position, so we wait until the node has settled.
  useEffect(() => {
    if (!focusNodeId) return
    let tries = 0
    let last: { x: number; y: number; z: number } | null = null
    const timer = setInterval(() => {
      const fg = fgRef.current
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node = graphData.nodes.find((n) => n.id === focusNodeId) as any
      if (++tries > 40) { clearInterval(timer); return }
      if (!fg || !node || node.x === undefined) return
      const moved = last
        ? Math.hypot(node.x - last.x, node.y - last.y, node.z - last.z)
        : Infinity
      last = { x: node.x, y: node.y, z: node.z }
      // settled (or we ran out of patience) → one clean flight
      if (moved > 1.5 && tries < 30) return
      clearInterval(timer)
      const len = Math.hypot(node.x, node.y, node.z) || 1
      const ratio = 1 + 70 / len
      fg.cameraPosition(
        { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
        node,
        dur(400),
      )
    }, 350)
    return () => clearInterval(timer)
  }, [focusNodeId, graphData, dur])

  // A repülés ENGED a mutatónak. A könyvtár fix idejű tweent futtat a
  // kamerán, miközben a felhasználó ugyanazt a kamerát orbitálja: eddig a
  // kettő verekedett, és egy megkezdett út nem volt megfogható félrepülésben
  // (§3). A kamera saját, ÉLŐ pózára kiadott 0ms-os utasítás a könyvtár
  // .end()+setCameraPos ágát üti egy tickben — a tween ugrás nélkül meghal.
  useEffect(() => {
    if (!ready) return
    const fg = fgRef.current
    const controls = fg?.controls?.()
    if (!controls?.addEventListener) return
    const stopFlight = () => {
      const c = fg.cameraPosition()
      if (!c) return
      fg.cameraPosition({ x: c.x, y: c.y, z: c.z }, controls.target, 0)
    }
    controls.addEventListener('start', stopFlight)
    return () => controls.removeEventListener('start', stopFlight)
  }, [ready])

  // Lenyomás-visszajelzés a gráf csomópontjain: a lap aláírás-felülete eddig
  // CSAK kattintásra reagált (§1/§10: a kiemelés a LENYOMÁSON ül).
  useEffect(() => {
    if (!ready) return
    const dom = fgRef.current?.renderer?.()?.domElement as HTMLElement | undefined
    if (!dom) return
    let pressed: THREE.Object3D | null = null
    const down = () => {
      const obj = hoveredRef.current?.__threeObj as THREE.Object3D | undefined
      if (!obj) return
      pressed = obj
      obj.scale.setScalar(0.94)
    }
    const release = () => {
      pressed?.scale.setScalar(1)
      pressed = null
    }
    dom.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      // a graphData cseréjekor a lib újraépíti a node-objektumokat
      release()
      dom.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [ready, graphData])

  // A renderelő eddig SOSE állt meg: a cooldownTime csak a d3-fizikát fogja
  // meg, a lib rAF-ciklusa feltétel nélkül újraütemezi magát, tehát több száz
  // sprite + 700 pontos csillagmező rajzolódott 60fps-en akkor is, ha a fül
  // háttérben volt. Középkategóriás telefonon ez folyamatos GPU-terhelés.
  useEffect(() => {
    if (!ready) return
    const onVis = () => {
      const fg = fgRef.current
      if (!fg) return
      if (document.hidden) fg.pauseAnimation?.()
      else fg.resumeAnimation?.()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      fgRef.current?.resumeAnimation?.()
    }
  }, [ready])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback((n: any) => {
    hoveredRef.current = n ?? null
    onAnimeHover(n?.type === 'anime' ? n.animeId ?? null : null)
    const clickable = n?.type === 'anime' || n?.type === 'ghost'
      || (!!onDimClick && n?.type === 'dim' && !n.timeNode)
    document.body.style.cursor = clickable ? 'pointer' : 'default'
  }, [onAnimeHover, onDimClick])

  return (
    <ForceGraph3D
      fgRef={attachFg}
      graphData={graphData}
      backgroundColor="rgba(0,0,0,0)"
      nodeThreeObject={nodeThreeObject}
      nodeLabel={nodeLabel}
      // csökkentett mozgásnál a layout az ELSŐ képkockára beáll, nem sodródik
      // 8 másodpercig a teljes viewporton keresztül
      warmupTicks={reduce ? 300 : 0}
      cooldownTime={reduce ? 0 : 8000}
      linkColor={linkColor}
      linkOpacity={0.28}
      linkWidth={0}
      linkLineDash={linkLineDash}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
    />
  )
}
