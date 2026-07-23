// Fit-score: „mennyire illik hozzád ez a cím?" — tisztán lokális, AI-hívás nélkül.
// A user listájából műfaj/tag-súlyvektort épít (pont > státusz-jel), a célcím
// feature-eivel vetíti össze. Ismeretlen feature nem büntet (kimarad a nevezőből);
// ha túl kevés az ismert feature vagy a minta, inkább nincs score, mint vak tipp.

export type TagEntryLite = { name: string; rank?: number }
export type TasteItem = { genres: string[]; tags: TagEntryLite[]; status: string; myScore: number | null }
export type FitTarget = { genres: string[]; tags: TagEntryLite[] }
export type TasteVector = { vector: Map<string, number>; sample: number }
export type FitResult = {
  score: number
  top: { name: string; weight: number }[]
  against: { name: string; weight: number }[]
}

export const MIN_SAMPLE = 5
const MIN_KNOWN_FEATURES = 1
const TAG_FEATURE_WEIGHT = 0.6
const STATUS_SIGNAL: Record<string, number> = { completed: 0.3, watching: 0.3, planned: 0.1, dropped: -0.8 }

function itemWeight(it: TasteItem): number {
  if (it.myScore != null) return (it.myScore - 5.5) / 4.5
  return STATUS_SIGNAL[it.status] ?? 0
}

function targetFeatures(target: FitTarget): { key: string; name: string; fw: number }[] {
  return [
    ...target.genres.map((g) => ({ key: `g:${g.toLowerCase()}`, name: g, fw: 1 })),
    ...target.tags.map((t) => ({ key: `t:${t.name.toLowerCase()}`, name: t.name, fw: TAG_FEATURE_WEIGHT })),
  ]
}

export function buildTasteVector(items: TasteItem[]): TasteVector {
  const vector = new Map<string, number>()
  for (const it of items) {
    const w = itemWeight(it)
    if (w === 0) continue
    for (const g of it.genres) {
      const key = `g:${g.toLowerCase()}`
      vector.set(key, (vector.get(key) ?? 0) + w)
    }
    for (const t of it.tags) {
      const key = `t:${t.name.toLowerCase()}`
      vector.set(key, (vector.get(key) ?? 0) + w * TAG_FEATURE_WEIGHT)
    }
  }
  // normalizálás [-1, 1]-re, hogy a nagy listák ne szaladjanak el
  let max = 0
  for (const v of vector.values()) max = Math.max(max, Math.abs(v))
  if (max > 0) for (const [k, v] of vector) vector.set(k, v / max)
  return { vector, sample: items.length }
}

export function computeFit(taste: TasteVector, target: FitTarget): FitResult | null {
  if (taste.sample < MIN_SAMPLE) return null
  const feats = targetFeatures(target)
  const known = feats.filter((f) => taste.vector.has(f.key))
  if (known.length < MIN_KNOWN_FEATURES) return null

  let matched = 0
  let denom = 0
  const contribs: { name: string; weight: number }[] = []
  for (const f of known) {
    const v = taste.vector.get(f.key)!
    matched += v * f.fw
    denom += f.fw
    contribs.push({ name: f.name, weight: v })
  }
  const score = Math.max(0, Math.min(100, Math.round(50 + 50 * (matched / denom))))
  const sorted = [...contribs].sort((a, b) => b.weight - a.weight)
  return {
    score,
    top: sorted.filter((c) => c.weight > 0.05).slice(0, 3),
    against: sorted.filter((c) => c.weight < -0.05).slice(-2).reverse(),
  }
}
