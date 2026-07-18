export type MineEntry = {
  anilistId: number
  title: string
  coverUrl: string | null
  myScore: number | null
}

export type TheirEntry = {
  anilistId: number
  title: string
  coverUrl: string | null
  score: number | null
}

export type CompareResult = {
  overlapPct: number
  commonCount: number
  mineCount: number
  theirsCount: number
  commonFavorites: { anilistId: number; title: string; coverUrl: string | null; myScore: number | null; theirScore: number | null }[]
  theyRecommend: TheirEntry[]
  iRecommend: MineEntry[]
}

export function compareLists(mine: MineEntry[], theirs: TheirEntry[]): CompareResult {
  const mineById = new Map(mine.map((m) => [m.anilistId, m]))
  const theirsById = new Map(theirs.map((t) => [t.anilistId, t]))

  const common = mine.filter((m) => theirsById.has(m.anilistId))
  const smaller = Math.min(mine.length, theirs.length)
  const overlapPct = smaller ? Math.round((common.length / smaller) * 100) : 0

  const commonFavorites = common
    .map((m) => ({
      anilistId: m.anilistId,
      title: m.title,
      coverUrl: m.coverUrl,
      myScore: m.myScore,
      theirScore: theirsById.get(m.anilistId)!.score,
    }))
    .filter((c) => (c.myScore ?? 0) >= 8 && (c.theirScore ?? 0) >= 8)
    .sort((a, b) => (b.myScore! + b.theirScore!) - (a.myScore! + a.theirScore!))
    .slice(0, 8)

  const theyRecommend = theirs
    .filter((t) => !mineById.has(t.anilistId))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)

  const iRecommend = mine
    .filter((m) => !theirsById.has(m.anilistId))
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0))
    .slice(0, 5)

  return {
    overlapPct,
    commonCount: common.length,
    mineCount: mine.length,
    theirsCount: theirs.length,
    commonFavorites,
    theyRecommend,
    iRecommend,
  }
}
