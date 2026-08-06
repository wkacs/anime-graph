import { describe, expect, it } from 'vitest'
import { buildProfileStats, type ProfileStatsRow } from './profile-stats'

function row(over: Partial<ProfileStatsRow>): ProfileStatsRow {
  return {
    titleRomaji: 'T', coverUrl: null, slug: 't', mediaType: 'ANIME',
    status: 'completed', myScore: null, year: 2020, genres: [],
    durationMin: 24, episodes: 12, progress: 12,
    ...over,
  }
}

describe('buildProfileStats', () => {
  it('üres listára nullákat ad, nem dob', () => {
    const s = buildProfileStats([])
    expect(s.total).toBe(0)
    expect(s.avgScore).toBeNull()
    expect(s.topTitles).toEqual([])
    expect(s.statusCounts.map((x) => x.count)).toEqual([0, 0, 0, 0])
  })

  it('órák: completed a teljes hossz, watching a progress szerint', () => {
    const s = buildProfileStats([
      row({ status: 'completed', durationMin: 30, episodes: 10, progress: 10 }), // 300p
      row({ status: 'watching', durationMin: 20, episodes: 24, progress: 6 }),   // 120p
    ])
    expect(s.watchedHours).toBe(7) // 420p / 60
  })

  it('átlagpont 1 tizedesre kerekítve, csak pontozottakból', () => {
    const s = buildProfileStats([
      row({ myScore: 7 }), row({ myScore: 8 }), row({ myScore: null }),
    ])
    expect(s.avgScore).toBe(7.5)
  })

  it('top-műfajok darabszám szerint, max 8', () => {
    const rows = [
      row({ genres: ['Action', 'Drama'] }),
      row({ genres: ['Action'] }),
      row({ genres: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }),
    ]
    const s = buildProfileStats(rows)
    expect(s.topGenres[0]).toEqual({ name: 'Action', count: 2 })
    expect(s.topGenres).toHaveLength(8)
  })

  it('top címek: pont szerint csökkenő, azonos pontnál cím szerint stabil, max 10', () => {
    const rows = [
      row({ titleRomaji: 'B', slug: 'b', myScore: 9 }),
      row({ titleRomaji: 'A', slug: 'a', myScore: 9 }),
      row({ titleRomaji: 'C', slug: 'c', myScore: 10 }),
      ...Array.from({ length: 12 }, (_, i) => row({ titleRomaji: `X${i}`, slug: `x${i}`, myScore: 5 })),
    ]
    const s = buildProfileStats(rows)
    expect(s.topTitles).toHaveLength(10)
    expect(s.topTitles.slice(0, 3).map((t) => t.title)).toEqual(['C', 'A', 'B'])
  })

  it('pont-eloszlás mind a 10 sávot adja', () => {
    const s = buildProfileStats([row({ myScore: 10 }), row({ myScore: 10 }), row({ myScore: 1 })])
    expect(s.scoreDist).toHaveLength(10)
    expect(s.scoreDist[9]).toEqual({ label: '10', count: 2 })
    expect(s.scoreDist[0]).toEqual({ label: '1', count: 1 })
  })
})
