import { describe, expect, it } from 'vitest'
import { availableYears, buildWrapped, type WrappedAnimeRow } from './wrapped'

const a = (over: Partial<WrappedAnimeRow>): WrappedAnimeRow => ({
  id: 1, titleRomaji: 'T', coverUrl: null, genres: ['Action'], studio: 'MAPPA',
  myScore: 8, mediaType: 'ANIME', durationMin: 24, chapters: null, progress: 12,
  watchedAt: '2026-02-10T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', ...over,
})

describe('buildWrapped', () => {
  it('órákat az epizód-logból számol, top műfaj/stúdió/anime jön', () => {
    const w = buildWrapped(
      [a({ id: 1 }), a({ id: 2, titleRomaji: 'U', myScore: 9, studio: 'Bones', genres: ['Drama'] })],
      [
        { animeId: 1, watchedAt: '2026-02-01T10:00:00Z' },
        { animeId: 1, watchedAt: '2026-02-02T10:00:00Z' },
        { animeId: 2, watchedAt: '2026-02-02T12:00:00Z' },
      ],
      [{ name: 'K', image: null, createdAt: '2026-03-01T00:00:00Z' }],
      2026,
    )
    expect(w.totalEpisodes).toBe(3)
    expect(w.totalHours).toBeCloseTo(3 * 24 / 60, 5)
    expect(w.topAnime[0].title).toBe('U')
    expect(w.topGenres.map((g) => g.name)).toContain('Action')
    expect(w.favChars).toHaveLength(1)
  })

  it('streak: egymást követő napok', () => {
    const w = buildWrapped([a({})], [
      { animeId: 1, watchedAt: '2026-02-01T10:00:00Z' },
      { animeId: 1, watchedAt: '2026-02-02T10:00:00Z' },
      { animeId: 1, watchedAt: '2026-02-03T10:00:00Z' },
      { animeId: 1, watchedAt: '2026-02-10T10:00:00Z' },
    ], [], 2026)
    expect(w.longestStreakDays).toBe(3)
  })

  it('másik év epizódjai nem számítanak', () => {
    const w = buildWrapped([a({})], [{ animeId: 1, watchedAt: '2025-02-01T10:00:00Z' }], [], 2026)
    expect(w.totalEpisodes).toBe(0)
  })
})

describe('availableYears', () => {
  it('epizód-log + watchedAt évei, csökkenő', () => {
    expect(availableYears(
      [a({ watchedAt: '2024-05-01T00:00:00Z' })],
      [{ animeId: 1, watchedAt: '2026-02-01T10:00:00Z' }],
    )).toEqual([2026, 2024])
  })
})

describe('wrapped — üres bemenet', () => {
  it('nem dob és definit struktúrát ad 0 animénél', () => {
    expect(() => buildWrapped([], [], [], new Date().getFullYear())).not.toThrow()
    const w = buildWrapped([], [], [], 2024)
    expect(w).toBeTruthy()
    // ne legyen NaN egyetlen szám-mezőben sem
    for (const v of Object.values(w)) {
      if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false)
    }
  })
  it('availableYears üres bemenetre üres tömb', () => {
    expect(availableYears([], [])).toEqual([])
  })
})
