export type TonightAnime = {
  id: number
  titleRomaji: string
  coverUrl: string | null
  status: string
  episodes: number | null
  format: string | null
  myScore: number | null
  avgScore: number | null
  progress: number
}

export type TonightMood = 'folytatas' | 'rovid' | 'comfort' | 'barmi'

export type TonightPick = TonightAnime & { reason: string }

const rand = <T,>(arr: T[], r: () => number): T => arr[Math.floor(r() * arr.length)]

// instant, deterministic-friendly picker — no AI call, no rate limit
export function pickTonight(
  rows: TonightAnime[],
  mood: TonightMood,
  r: () => number = Math.random,
): TonightPick | null {
  if (!rows.length) return null

  const watching = rows.filter((a) => a.status === 'watching')
  const planned = rows.filter((a) => a.status === 'planned')
  const comfort = rows
    .filter((a) => a.status === 'completed' && (a.myScore ?? 0) >= 8)
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))

  if (mood === 'folytatas' && watching.length) {
    const a = rand(watching, r)
    return { ...a, reason: `Már a ${a.progress}. résznél jársz — ma este eggyel közelebb a végéhez.` }
  }
  if (mood === 'rovid') {
    const short = planned
      .filter((a) => (a.episodes != null && a.episodes <= 13) || a.format === 'MOVIE')
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    if (short.length) {
      const a = short[Math.floor(r() * Math.min(3, short.length))]
      return { ...a, reason: a.format === 'MOVIE' ? 'Egy film — ma este be is fejezed.' : `Csak ${a.episodes} rész — gyorsan végigmegy.` }
    }
  }
  if (mood === 'comfort' && comfort.length) {
    const a = comfort[Math.floor(r() * Math.min(3, comfort.length))]
    return { ...a, reason: `${a.myScore}/10-et adtál rá — garantált jó este, nulla kockázat.` }
  }

  // barmi + fallbackok: tervezett (népszerűség szerint súlyozva) → nézem → comfort
  const pool = planned.length ? planned : watching.length ? watching : comfort
  if (!pool.length) return null
  const sorted = [...pool].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
  const a = sorted[Math.floor(r() * Math.min(5, sorted.length))]
  const reason = a.status === 'planned'
    ? 'Régóta ott ül a tervezett listádon — ma este itt az ideje.'
    : a.status === 'watching'
      ? `Már elkezdted (${a.progress}. rész) — folytasd ma este.`
      : `${a.myScore}/10 — újranézésre mindig jó.`
  return { ...a, reason }
}
