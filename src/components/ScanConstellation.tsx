'use client'
import { motion } from 'framer-motion'
import type { ConstellationNode, TasteIsland } from '@/lib/taste-scan'

// A scan reszleges „grafja". Szandekosan NEM a 3D-vaszon: az a regisztracio
// mogotti termek. Ez egy determinisztikus, konnyu SVG, ami az elso masodpercben
// megjelenik, mobilon sem akad, es kesobb valtozatlanul kithetheto megoszthato
// kepbe is (nincs benne se WebGL, se veletlen).
//
// Az elrendezes a libbol jon (buildConstellation): itt csak skalazunk es rajzolunk.

const VIEW = 100
/** kis parna, hogy a szelso csomopont ne logjon ki a viewBoxbol */
const PAD = 8

const ISLAND_HUES = [265, 190, 25, 330, 145]

function pos(v: number): number {
  return VIEW / 2 + v * (VIEW / 2 - PAD)
}

export default function ScanConstellation({
  nodes, edges, islands,
}: {
  nodes: ConstellationNode[]
  edges: [number, number][]
  islands: TasteIsland[]
}) {
  if (nodes.length === 0) return null

  const hueOf = (island: string) => {
    const i = islands.findIndex((x) => x.name === island)
    return i >= 0 ? ISLAND_HUES[i % ISLAND_HUES.length] : 0
  }
  const colorOf = (island: string) =>
    islands.some((x) => x.name === island)
      ? `hsl(${hueOf(island)} 70% 68%)`
      : 'rgba(255,255,255,.5)'

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="h-full w-full"
      role="img"
      aria-label={islands.map((i) => i.name).join(', ')}
    >
      <g stroke="rgba(255,255,255,.16)" strokeWidth={0.22}>
        {edges.map(([a, b]) => (
          <motion.line
            key={`${a}-${b}`}
            x1={pos(nodes[a].x)} y1={pos(nodes[a].y)}
            x2={pos(nodes[b].x)} y2={pos(nodes[b].y)}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.15 + (a % 10) * 0.02 }}
          />
        ))}
      </g>
      {nodes.map((n, i) => (
        <motion.circle
          key={n.anilistId}
          cx={pos(n.x)} cy={pos(n.y)}
          r={1.1 + n.r * 2.2}
          fill={colorOf(n.island)}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: i * 0.012 }}
          style={{ transformOrigin: `${pos(n.x)}px ${pos(n.y)}px` }}
        >
          <title>{n.title}</title>
        </motion.circle>
      ))}
    </svg>
  )
}
