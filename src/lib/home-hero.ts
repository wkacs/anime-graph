// A cimlap hero-jaba kerulo cim kivalasztasa. Tiszta fuggveny, hogy a
// fallback-lanc tesztelheto legyen — a projektben csak node-kornyezetu
// lib-teszt fut, komponens-teszt nincs.

/** strukturalis reszhalmaz: a page.tsx MineItem tipusa kielegiti */
export type HeroMine = {
  animeId: number
  anilistId: number
  title: string
  coverUrl: string | null
  status: string
  progress: number
  episodes: number | null
  airingAt: number
  nextEpisode: number
}

/** strukturalis reszhalmaz: a page.tsx SeasonItem tipusa kielegiti */
export type HeroSeason = {
  anilistId: number
  title: string
  coverUrl: string | null
  tasteScore: number | null
}

// Generikus a bemeneti tipusokban, hogy a hivo a SAJAT (bovebb) tipusat kapja
// vissza: a page.tsx MineItem-et ad be es MineItem-et var a callbackjeihez.
export type HeroPick<M = HeroMine, S = HeroSeason> =
  | { kind: 'airing'; item: M }
  | { kind: 'watching'; item: M }
  | { kind: 'discover'; item: S; score: number | null }
  | { kind: 'empty' }

export function pickHero<M extends HeroMine, S extends HeroSeason>(
  mine: M[],
  season: S[],
  nowSec: number,
  fit: Record<number, number> = {},
): HeroPick<M, S> {
  // 1. a legkozelebb adasba kerulo kovetett cim
  const upcoming = mine
    .filter((m) => m.airingAt > nowSec)
    .sort((a, b) => a.airingAt - b.airingAt || a.animeId - b.animeId)
  if (upcoming.length > 0) return { kind: 'airing', item: upcoming[0] }

  // 2. nincs jovobeli adas: a legelorehaladottabb nezett cim
  const watching = mine
    .filter((m) => m.status === 'watching')
    .sort((a, b) => b.progress - a.progress || a.animeId - b.animeId)
  if (watching.length > 0) return { kind: 'watching', item: watching[0] }

  // 3. felderites: a legjobb pontszamu szezon-cim.
  //
  //    FONTOS: az AI-taste-pontszam es a lokalis fit-becsles NEM ugyanazon a
  //    skalan van (lasd SCORE_THRESHOLDS: fit high=70, taste high=75), ezert
  //    nem szabad oket egymassal osszehasonlitani. Ha barmelyik cimnek van
  //    taste-pontszama, KIZAROLAG a taste-pontszamos cimek kozul valasztunk;
  //    a fit-becsles csak akkor dont, ha egyetlen taste-pontszam sincs.
  if (season.length > 0) {
    const tasteScored = season.filter((s) => s.tasteScore != null)
    const pool = tasteScored.length > 0 ? tasteScored : season
    const scoreOf = (s: S): number | null =>
      tasteScored.length > 0 ? s.tasteScore : (fit[s.anilistId] ?? null)

    let best = pool[0]
    let bestScore = scoreOf(pool[0])
    for (const s of pool.slice(1)) {
      const sc = scoreOf(s)
      if (sc != null && (bestScore == null || sc > bestScore)) {
        best = s
        bestScore = sc
      }
    }
    return { kind: 'discover', item: best, score: bestScore }
  }

  // 4. nincs mit mutatni
  return { kind: 'empty' }
}
