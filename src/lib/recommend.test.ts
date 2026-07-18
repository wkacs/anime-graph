import { describe, it, expect } from 'vitest'
import { parsePicks, buildRecommendMessages } from './recommend'
import type { RecCandidate } from './anilist'

describe('parsePicks', () => {
  it('parses valid picks', () => {
    const raw = '{"picks":[{"anilistId":123,"reason":"a Steins;Gate-nél a plot-twisteket dicsérted"}]}'
    expect(parsePicks(raw)).toEqual([{ anilistId: 123, reason: 'a Steins;Gate-nél a plot-twisteket dicsérted' }])
  })

  it('rejects picks without anilistId', () => {
    expect(() => parsePicks('{"picks":[{"reason":"xx xx xx"}]}')).toThrow()
  })
})

describe('buildRecommendMessages', () => {
  it('lists candidates with ids and includes taste facts', () => {
    const cands: RecCandidate[] = [
      { anilistId: 5, title: 'Monogatari', coverUrl: null, genres: ['Mystery'], avgScore: 85 },
    ]
    const msgs = buildRecommendMessages(
      cands,
      [{ kind: 'like', text: 'gyors tempó tetszett', title: 'FMA:B' }],
      ['FMA:B'],
    )
    expect(msgs[1].content).toContain('[5] Monogatari')
    expect(msgs[1].content).toContain('gyors tempó tetszett')
    expect(msgs[1].content).toContain('FMA:B')
  })
})
