import { describe, expect, it } from 'vitest'
import { airedSeasons, parseLeaderboardTab, COMMUNITY_MIN_COUNT, LEADERBOARD_LIMIT } from './leaderboard'

describe('parseLeaderboardTab', () => {
  it('ismert fulek', () => {
    expect(parseLeaderboardTab('sajat')).toBe('sajat')
    expect(parseLeaderboardTab('nepszeru')).toBe('nepszeru')
    expect(parseLeaderboardTab('anilist')).toBe('anilist')
  })
  it('ismeretlen/null -> anilist', () => {
    expect(parseLeaderboardTab('x')).toBe('anilist')
    expect(parseLeaderboardTab(null)).toBe('anilist')
  })
})

it('kuszobok', () => {
  expect(COMMUNITY_MIN_COUNT).toBe(2)
  expect(LEADERBOARD_LIMIT).toBe(50)
})

describe('airedSeasons', () => {
  it('nyaron: tel+tavasz+nyar', () => {
    expect(airedSeasons(new Date('2026-07-24T12:00:00Z'))).toEqual(['WINTER', 'SPRING', 'SUMMER'])
  })
  it('decemberben mind a negy', () => {
    expect(airedSeasons(new Date('2026-12-05T12:00:00Z'))).toEqual(['WINTER', 'SPRING', 'SUMMER', 'FALL'])
  })
})
