// Ízlés-kompatibilitás (D4): két user súlyvektorának koszinusz-hasonlósága [0-100].
// A publikus profilon a bejelentkezett néző látja, mennyire passzol az ízlésük —
// „közös nézéshez társkereső". Címlista nem megy át, csak aggregált feature-ök.

import { MIN_SAMPLE, type TasteVector } from './fit-score'

export type CompatResult = { score: number; common: string[] }

function displayName(key: string): string {
  return key.slice(2).replace(/\b\w/g, (c) => c.toUpperCase())
}

export function compatScore(a: TasteVector, b: TasteVector): CompatResult | null {
  if (a.sample < MIN_SAMPLE || b.sample < MIN_SAMPLE) return null
  const keys = new Set([...a.vector.keys(), ...b.vector.keys()])
  if (!keys.size) return null
  let dot = 0
  let normA = 0
  let normB = 0
  for (const k of keys) {
    const va = a.vector.get(k) ?? 0
    const vb = b.vector.get(k) ?? 0
    dot += va * vb
    normA += va * va
    normB += vb * vb
  }
  if (normA === 0 || normB === 0) return null
  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  const score = Math.max(0, Math.min(100, Math.round(((cos + 1) / 2) * 100)))
  const common = [...keys]
    .filter((k) => (a.vector.get(k) ?? 0) > 0.25 && (b.vector.get(k) ?? 0) > 0.25)
    .sort((x, y) => ((b.vector.get(y) ?? 0) + (a.vector.get(y) ?? 0)) - ((b.vector.get(x) ?? 0) + (a.vector.get(x) ?? 0)))
    .slice(0, 3)
    .map(displayName)
  return { score, common }
}
