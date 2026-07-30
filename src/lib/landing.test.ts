import { describe, expect, it } from 'vitest'
import { pickLandingCovers, type LandingCover } from './landing'

function cover(anilistId: number, coverUrl: string | null = `https://img/${anilistId}.jpg`): LandingCover {
  return {
    anilistId,
    mediaType: 'ANIME',
    slug: `title-${anilistId}`,
    titleRomaji: `Title ${anilistId}`,
    titleEnglish: null,
    coverUrl,
    format: 'TV',
    year: 2026,
    avgScore: 80,
  }
}

describe('pickLandingCovers', () => {
  it('a szezonális címek jönnek előre, a popular tölti fel a maradékot', () => {
    const out = pickLandingCovers([cover(1), cover(2)], [cover(10), cover(11)], 3)
    expect(out.map((c) => c.anilistId)).toEqual([1, 2, 10])
  })

  it('borító nélküli cím nem kerülhet a kollázsba', () => {
    const out = pickLandingCovers([cover(1, null), cover(2)], [cover(10)], 3)
    expect(out.map((c) => c.anilistId)).toEqual([2, 10])
  })

  it('a két lista közös címe csak egyszer szerepel', () => {
    const out = pickLandingCovers([cover(1), cover(2)], [cover(2), cover(3)], 4)
    expect(out.map((c) => c.anilistId)).toEqual([1, 2, 3])
  })

  it('üres bemenetre üres a kimenet', () => {
    expect(pickLandingCovers([], [], 6)).toEqual([])
  })
})
