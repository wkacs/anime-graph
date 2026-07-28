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

/**
 * Az indoklas kulcs + behelyettesitendo ertekek, nem kesz mondat: a valasztas
 * logikaja nyelvfuggetlen, a szoveget a felulet rakja ossze a `tonight`
 * namespace-bol. Igy a picker tesztelheto marad nyelvi fuggoseg nelkul.
 */
export type TonightReason =
  | { key: 'resume'; progress: number }
  | { key: 'movie' }
  | { key: 'shortSeries'; episodes: number }
  | { key: 'comfort'; score: number }
  | { key: 'longPlanned' }
  | { key: 'rewatch'; score: number }

export type TonightPick = TonightAnime & { reason: TonightReason }

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
    return { ...a, reason: { key: 'resume', progress: a.progress } }
  }
  if (mood === 'rovid') {
    const short = planned
      .filter((a) => (a.episodes != null && a.episodes <= 13) || a.format === 'MOVIE')
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    if (short.length) {
      const a = short[Math.floor(r() * Math.min(3, short.length))]
      return {
        ...a,
        reason: a.format === 'MOVIE'
          ? { key: 'movie' }
          : { key: 'shortSeries', episodes: a.episodes ?? 0 },
      }
    }
  }
  if (mood === 'comfort' && comfort.length) {
    const a = comfort[Math.floor(r() * Math.min(3, comfort.length))]
    return { ...a, reason: { key: 'comfort', score: a.myScore ?? 0 } }
  }

  // barmi + fallbackok: tervezett (népszerűség szerint súlyozva) → nézem → comfort
  const pool = planned.length ? planned : watching.length ? watching : comfort
  if (!pool.length) return null
  const sorted = [...pool].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
  const a = sorted[Math.floor(r() * Math.min(5, sorted.length))]
  const reason: TonightReason = a.status === 'planned'
    ? { key: 'longPlanned' }
    : a.status === 'watching'
      ? { key: 'resume', progress: a.progress }
      : { key: 'rewatch', score: a.myScore ?? 0 }
  return { ...a, reason }
}
