import { describe, expect, it } from 'vitest'
import { parseLeaderboardTab, COMMUNITY_MIN_COUNT, LEADERBOARD_LIMIT } from './leaderboard'

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
