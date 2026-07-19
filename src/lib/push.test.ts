import { describe, expect, it } from 'vitest'
import { buildAiringPayload, pickUpcoming } from './push'

describe('pickUpcoming', () => {
  it('csak a következő ablakban adásba kerülőket adja', () => {
    const now = 1_000_000
    const airing = [
      { anilistId: 1, airingAt: now + 60 * 60, nextEpisode: 5 },     // 60 perc múlva → benne
      { anilistId: 2, airingAt: now + 3 * 3600, nextEpisode: 2 },    // 3 óra múlva → nem
      { anilistId: 3, airingAt: now - 600, nextEpisode: 8 },          // már lement → nem
    ]
    expect(pickUpcoming(airing, now, 70).map((a) => a.anilistId)).toEqual([1])
  })
})

describe('buildAiringPayload', () => {
  it('magyar szöveget és url-t épít', () => {
    const p = buildAiringPayload('Frieren', 12)
    expect(p.title).toContain('Frieren')
    expect(p.body).toContain('12')
    expect(p.url).toBe('/')
  })
})
