import { describe, expect, it } from 'vitest'
import { trendingSeasonParams, TRENDING_LIMIT } from './trending'

describe('trendingSeasonParams', () => {
  it('aktualis szezont adja', () => {
    expect(trendingSeasonParams(new Date('2026-07-24T12:00:00Z'))).toEqual({ season: 'SUMMER', year: 2026 })
  })
  it('teli szezon evvalto elott', () => {
    expect(trendingSeasonParams(new Date('2026-02-10T12:00:00Z'))).toEqual({ season: 'WINTER', year: 2026 })
  })
  it('limit 12', () => {
    expect(TRENDING_LIMIT).toBe(12)
  })
})
