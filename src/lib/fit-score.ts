import { SCORE_THRESHOLDS } from './score-color'

// Fit-score: „mennyire illik hozzád ez a cím?" — tisztán lokális, AI-hívás nélkül.
// A user listájából műfaj/tag-súlyvektort épít (pont > státusz-jel), a célcím
// feature-eivel vetíti össze. Ismeretlen feature nem büntet (kimarad a nevezőből);
// ha túl kevés az ismert feature vagy a minta, inkább nincs score, mint vak tipp.

export type TagEntryLite = { name: string; rank?: number }
export type TasteItem = { genres: string[]; tags: TagEntryLite[]; status: string; myScore: number | null }
/** `extraKeys`: származtatott tengelyek (length/era/format/studio/source) kész kulcsként */
export type FitTarget = { genres: string[]; tags: TagEntryLite[]; extraKeys?: string[] }
/** Az extract kötött szókészletű kimenete — a szemantikus ág bemenete. */
export type SignalInput = { feature: string; polarity: number; strength: number }
export type TasteVector = { vector: Map<string, number>; sample: number }
export type FitResult = {
  score: number
  top: { name: string; weight: number }[]
  against: { name: string; weight: number }[]
}

export const MIN_SAMPLE = 5
const MIN_KNOWN_FEATURES = 1
const TAG_FEATURE_WEIGHT = 0.6
// A származtatott tengely gyengébb jel, mint egy műfaj, de erősebb a semminél.
const EXTRA_FEATURE_WEIGHT = 0.5

// A szemantikus jel súlya a kombinált vektorban. Kevés jelnél arányosan csökken,
// hogy egy-két vélemény ne forgassa fel a listát.
export const SIGNAL_ALPHA = 0.4
export const SIGNAL_FULL_WEIGHT_AT = 20
const STATUS_SIGNAL: Record<string, number> = { completed: 0.3, watching: 0.3, planned: 0.1, dropped: -0.8 }

function itemWeight(it: TasteItem): number {
  if (it.myScore != null) return (it.myScore - 5.5) / 4.5
  return STATUS_SIGNAL[it.status] ?? 0
}

function targetFeatures(target: FitTarget): { key: string; name: string; fw: number }[] {
  return [
    ...target.genres.map((g) => ({ key: `g:${g.toLowerCase()}`, name: g, fw: 1 })),
    ...target.tags.map((t) => ({ key: `t:${t.name.toLowerCase()}`, name: t.name, fw: TAG_FEATURE_WEIGHT })),
    ...(target.extraKeys ?? []).map((k) => ({
      key: k.toLowerCase(), name: k.split(':')[1] ?? k, fw: EXTRA_FEATURE_WEIGHT,
    })),
  ]
}

// normalizálás [-1, 1]-re, hogy a nagy listák ne szaladjanak el
function normalize(vector: Map<string, number>): Map<string, number> {
  let max = 0
  for (const v of vector.values()) max = Math.max(max, Math.abs(v))
  if (max > 0) for (const [k, v] of vector) vector.set(k, v / max)
  return vector
}

function behaviouralVector(items: TasteItem[]): Map<string, number> {
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
  return normalize(vector)
}

function semanticVector(signals: SignalInput[]): Map<string, number> {
  const vector = new Map<string, number>()
  for (const s of signals) {
    const key = s.feature.toLowerCase()
    vector.set(key, (vector.get(key) ?? 0) + (s.polarity >= 0 ? 1 : -1) * s.strength)
  }
  return normalize(vector)
}

export function buildTasteVector(items: TasteItem[], signals: SignalInput[] = []): TasteVector {
  const behaviour = behaviouralVector(items)
  if (signals.length === 0) return { vector: behaviour, sample: items.length }

  // Külön-külön normalizálunk: több száz értékelés áll szemben pár tucat jellel,
  // közös normalizálás elnyomná a szemantikát.
  const semantic = semanticVector(signals)
  const alpha = SIGNAL_ALPHA * Math.min(1, signals.length / SIGNAL_FULL_WEIGHT_AT)
  const combined = new Map<string, number>()
  for (const key of new Set([...behaviour.keys(), ...semantic.keys()])) {
    combined.set(key, (behaviour.get(key) ?? 0) * (1 - alpha) + (semantic.get(key) ?? 0) * alpha)
  }
  return { vector: combined, sample: items.length }
}

// Drop-rizikó (D7): CSAK a droppolt címekből épített affinitás-vektor — „miket szoktál dobni".
// Minden droppolt elem +1 súllyal megy be, így a computeFit score itt drop-VALÓSZÍNŰSÉGET mér.
export const MIN_DROP_SAMPLE = 3

export function buildDropVector(items: TasteItem[]): TasteVector {
  const dropped = items.filter((it) => it.status === 'dropped')
  return {
    ...buildTasteVector(dropped.map((it) => ({ ...it, status: 'completed', myScore: 10 }))),
    sample: dropped.length,
  }
}

export function computeDropRisk(items: TasteItem[], target: FitTarget): FitResult | null {
  const vec = buildDropVector(items)
  if (vec.sample < MIN_DROP_SAMPLE) return null
  // a computeFit MIN_SAMPLE-je a teljes listára van kalibrálva; droppból kevesebb is elég
  return computeFit({ ...vec, sample: Math.max(vec.sample, MIN_SAMPLE) }, target)
}

// A puszta „78%" pontosabbnak latszik, mint amit egy heurisztikus becsles birni
// tud. Ezert a felulet elsodleges informacioja a fokozat, a szazalek masodlagos.
// A kuszobok a kozos SCORE_THRESHOLDS.fit-bol jonnek, hogy a szin es a cimke
// soha ne mondjon mast; a 'low' hataran alul kulon fokozat all, mert az „nem
// tipikus neked, de nem is kizarva" eset nem ugyanaz, mint a tiszta elutasitas.
export type FitTier = 'strong' | 'mixed' | 'experimental' | 'low'
export const EXPERIMENTAL_MIN = 30

export function fitTier(score: number): FitTier {
  const { high, mid } = SCORE_THRESHOLDS.fit
  if (score >= high) return 'strong'
  if (score >= mid) return 'mixed'
  if (score >= EXPERIMENTAL_MIN) return 'experimental'
  return 'low'
}

// Mennyi bizonyitek all a becsles mogott. Ket fuggetlen tenyezo: mekkora a
// lista (sample) es abbol hany cim kapcsolodik egyaltalan a celcimhez (related).
// Nagy lista onmagaban nem eleg: 600 shonen mellett egy iyashikei becslese
// tovabbra is vaktipp.
export type FitConfidence = 'high' | 'medium' | 'low'
export const CONFIDENCE_HIGH = { sample: 40, related: 15 } as const
export const CONFIDENCE_MEDIUM = { sample: 15, related: 5 } as const

export function fitConfidence(sample: number, related: number): FitConfidence {
  if (sample >= CONFIDENCE_HIGH.sample && related >= CONFIDENCE_HIGH.related) return 'high'
  if (sample >= CONFIDENCE_MEDIUM.sample && related >= CONFIDENCE_MEDIUM.related) return 'medium'
  return 'low'
}

// Hany listaelem oszt legalabb egy feature-t a celcimmel. Ez a „Based on N
// related titles" allitas forrasa — csak azt szamolja, ami tenyleg szamitott.
export function relatedCount(items: TasteItem[], target: FitTarget): number {
  const keys = new Set(targetFeatures(target).map((f) => f.key))
  let n = 0
  for (const it of items) {
    const hit =
      it.genres.some((g) => keys.has(`g:${g.toLowerCase()}`)) ||
      it.tags.some((t) => keys.has(`t:${t.name.toLowerCase()}`))
    if (hit) n++
  }
  return n
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
