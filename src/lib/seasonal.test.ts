import { describe, it, expect } from 'vitest'
import { currentSeason, nextSeason, parseSeasonScores, buildSeasonMessages, SEASON_LABELS } from './seasonal'

describe('nextSeason', () => {
  it('évhatárt is kezel', () => {
    expect(nextSeason(new Date('2026-07-19'))).toEqual({ season: 'FALL', year: 2026 })
    expect(nextSeason(new Date('2026-11-10'))).toEqual({ season: 'WINTER', year: 2027 })
  })
})

describe('currentSeason', () => {
  it('maps months to AniList seasons', () => {
    expect(currentSeason(new Date('2026-01-15'))).toEqual({ season: 'WINTER', year: 2026 })
    expect(currentSeason(new Date('2026-04-01'))).toEqual({ season: 'SPRING', year: 2026 })
    expect(currentSeason(new Date('2026-07-18'))).toEqual({ season: 'SUMMER', year: 2026 })
    expect(currentSeason(new Date('2026-11-30'))).toEqual({ season: 'FALL', year: 2026 })
  })

  it('has a Hungarian label for every season', () => {
    for (const s of ['WINTER', 'SPRING', 'SUMMER', 'FALL']) {
      expect(SEASON_LABELS[s]).toBeTruthy()
    }
  })
})

describe('parseSeasonScores', () => {
  it('parses a valid score list', () => {
    const raw = '{"scores":[{"anilistId":9253,"score":88,"reason":"time-travel, ami a kedvenced"}]}'
    expect(parseSeasonScores(raw)).toEqual([
      { anilistId: 9253, score: 88, reason: 'time-travel, ami a kedvenced' },
    ])
  })

  it('rejects scores outside 0-100', () => {
    expect(() => parseSeasonScores('{"scores":[{"anilistId":1,"score":150,"reason":"tul jo lenne"}]}')).toThrow()
  })
})

describe('buildSeasonMessages', () => {
  it('lists candidates and taste facts', () => {
    const msgs = buildSeasonMessages(
      [{ anilistId: 7, title: 'Uj Anime', coverUrl: null, genres: ['Action'], avgScore: 75 }],
      ['(like) gyors tempó'],
    )
    expect(msgs[1].content).toContain('[7] Uj Anime')
    expect(msgs[1].content).toContain('gyors tempó')
  })
})
