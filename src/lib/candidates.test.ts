import { describe, it, expect } from 'vitest'
import { genreWeights, rankCandidates } from './candidates'
import type { RecCandidate } from './anilist'

const cand = (id: number, genres: string[], avgScore = 70): RecCandidate => ({
  anilistId: id, title: `T${id}`, coverUrl: null, genres, avgScore,
})

describe('genreWeights', () => {
  it('weights genres by score above/below neutral 5 and elo offset', () => {
    const w = genreWeights([
      { genres: ['Action'], myScore: 9, elo: 1200 },   // +4
      { genres: ['Drama'], myScore: 3, elo: 1200 },    // -2
      { genres: ['Action'], myScore: null, elo: 1400 }, // 0 + 0.5
    ])
    expect(w.get('Action')).toBeCloseTo(4.5)
    expect(w.get('Drama')).toBeCloseTo(-2)
  })
})

describe('rankCandidates', () => {
  it('excludes owned and dedupes', () => {
    const out = rankCandidates(
      [cand(1, ['Action']), cand(1, ['Action']), cand(2, ['Action'])],
      new Set([2]),
      new Map([['Action', 3]]),
    )
    expect(out.map((c) => c.anilistId)).toEqual([1])
  })

  it('ranks higher genre-weight overlap first', () => {
    const out = rankCandidates(
      [cand(1, ['Drama'], 80), cand(2, ['Action'], 60)],
      new Set(),
      new Map([['Action', 5], ['Drama', -1]]),
    )
    expect(out[0].anilistId).toBe(2)
  })

  it('applies the limit', () => {
    const cands = Array.from({ length: 40 }, (_, i) => cand(i + 1, ['Action']))
    expect(rankCandidates(cands, new Set(), new Map(), 30)).toHaveLength(30)
  })
})
