import { describe, it, expect } from 'vitest'
import { seasonStartInfo, buildSeasonPayload } from './season-push'

describe('seasonStartInfo', () => {
  it('szezon-kezdő hónap első napjai → szezon-info', () => {
    expect(seasonStartInfo(new Date('2026-07-02T12:00:00Z'))).toEqual({ year: 2026, season: 'SUMMER' })
    expect(seasonStartInfo(new Date('2026-01-01T12:00:00Z'))).toEqual({ year: 2026, season: 'WINTER' })
    expect(seasonStartInfo(new Date('2026-04-03T12:00:00Z'))).toEqual({ year: 2026, season: 'SPRING' })
    expect(seasonStartInfo(new Date('2026-10-01T12:00:00Z'))).toEqual({ year: 2026, season: 'FALL' })
  })

  it('ablakon kívül (4. naptól vagy nem kezdő hónap) → null', () => {
    expect(seasonStartInfo(new Date('2026-07-04T12:00:00Z'))).toBeNull()
    expect(seasonStartInfo(new Date('2026-08-01T12:00:00Z'))).toBeNull()
  })

  it('budapesti napváltó: UTC 23:00 = másnap Budapesten', () => {
    // 2026-06-30 23:00 UTC = júl 1. 01:00 Budapesten → már SUMMER-ablak
    expect(seasonStartInfo(new Date('2026-06-30T23:00:00Z'))).toEqual({ year: 2026, season: 'SUMMER' })
  })
})

describe('buildSeasonPayload', () => {
  it('magyar szezonnév + főoldali url', () => {
    const p = buildSeasonPayload(2026, 'SUMMER')
    expect(p.title).toContain('nyári')
    expect(p.title).toContain('2026')
    expect(p.url).toBe('/')
  })
})
