import { describe, it, expect } from 'vitest'
import { pickTonight, type TonightAnime } from './tonight'

const mk = (over: Partial<TonightAnime>): TonightAnime => ({
  id: 1, titleRomaji: 'A', coverUrl: null, status: 'planned',
  episodes: 24, format: 'TV', myScore: null, avgScore: 75, progress: 0, ...over,
})

describe('pickTonight', () => {
  it('folytatas picks a watching anime', () => {
    const rows = [
      mk({ id: 1, status: 'watching', progress: 5 }),
      mk({ id: 2, status: 'planned' }),
    ]
    const pick = pickTonight(rows, 'folytatas', () => 0)
    expect(pick?.id).toBe(1)
    // Kulcs + ertek, nem kesz mondat: a picker nem tud a felulet nyelverol.
    expect(pick?.reason).toEqual({ key: 'resume', progress: 5 })
  })

  it('rovid indoklasa megkulonbozteti a filmet a rovid sorozattol', () => {
    const movie = pickTonight([mk({ id: 1, status: 'planned', episodes: 1, format: 'MOVIE' })], 'rovid', () => 0)
    expect(movie?.reason).toEqual({ key: 'movie' })
    const series = pickTonight([mk({ id: 2, status: 'planned', episodes: 12 })], 'rovid', () => 0)
    expect(series?.reason).toEqual({ key: 'shortSeries', episodes: 12 })
  })

  it('rovid prefers short planned shows or movies', () => {
    const rows = [
      mk({ id: 1, status: 'planned', episodes: 24 }),
      mk({ id: 2, status: 'planned', episodes: 12 }),
      mk({ id: 3, status: 'completed', episodes: 1, format: 'MOVIE' }),
    ]
    const pick = pickTonight(rows, 'rovid', () => 0)
    expect(pick?.id).toBe(2)
  })

  it('comfort picks a high-scored completed anime', () => {
    const rows = [
      mk({ id: 1, status: 'completed', myScore: 9 }),
      mk({ id: 2, status: 'completed', myScore: 5 }),
      mk({ id: 3, status: 'planned' }),
    ]
    const pick = pickTonight(rows, 'comfort', () => 0)
    expect(pick?.id).toBe(1)
  })

  it('barmi falls back across pools and returns null on empty list', () => {
    expect(pickTonight([], 'barmi', () => 0)).toBeNull()
    const pick = pickTonight([mk({ id: 7, status: 'completed', myScore: 9 })], 'barmi', () => 0)
    expect(pick?.id).toBe(7)
  })
})
