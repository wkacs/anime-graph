import { describe, it, expect } from 'vitest'
import { eloExpected, eloUpdate, pickDuelPair } from './elo'

describe('eloExpected', () => {
  it('is 0.5 for equal ratings', () => {
    expect(eloExpected(1200, 1200)).toBeCloseTo(0.5)
  })

  it('is ~0.909 for +400 advantage', () => {
    expect(eloExpected(1600, 1200)).toBeCloseTo(0.9090909, 4)
  })
})

describe('eloUpdate', () => {
  it('transfers 16 points between equals at K=32', () => {
    const { winner, loser } = eloUpdate(1200, 1200)
    expect(winner).toBeCloseTo(1216)
    expect(loser).toBeCloseTo(1184)
  })

  it('gives fewer points when the favourite wins', () => {
    const { winner } = eloUpdate(1600, 1200)
    expect(winner - 1600).toBeLessThan(4)
  })

  it('is zero-sum', () => {
    const { winner, loser } = eloUpdate(1350, 1240)
    expect(winner + loser).toBeCloseTo(1350 + 1240)
  })
})

describe('pickDuelPair', () => {
  const rows = [
    { id: 1, elo: 1200 },
    { id: 2, elo: 1210 },
    { id: 3, elo: 1600 },
    { id: 4, elo: 1195 },
  ]

  it('returns null with fewer than two rows', () => {
    expect(pickDuelPair([{ id: 1, elo: 1200 }], () => 0)).toBeNull()
  })

  it('never pairs an anime with itself', () => {
    for (const seed of [0, 0.3, 0.6, 0.99]) {
      const pair = pickDuelPair(rows, () => seed)
      expect(pair).not.toBeNull()
      expect(pair![0].id).not.toBe(pair![1].id)
    }
  })

  it('prefers a close-elo opponent', () => {
    // rand() = 0 → picks rows[0] (elo 1200), then the closest opponent (1195)
    const pair = pickDuelPair(rows, () => 0)
    expect(pair![0].id).toBe(1)
    expect(pair![1].id).toBe(4)
  })
})
