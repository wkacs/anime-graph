import { describe, it, expect } from 'vitest'
import { bayesianScore } from './community-score'

describe('bayesianScore', () => {
  it('returns null with no votes', () => {
    expect(bayesianScore(0, 0, 7)).toBeNull()
  })
  it('pulls a single high vote toward the global mean', () => {
    // one 10 vote, global mean 7, prior 10 -> (10*7 + 10)/(10+1) = 80/11 ≈ 7.27
    expect(bayesianScore(10, 1, 7)).toBeCloseTo(7.2727, 3)
  })
  it('approaches the raw mean as n grows', () => {
    // 1000 votes averaging 9 -> close to 9
    expect(bayesianScore(9000, 1000, 7)).toBeCloseTo(8.98, 2)
  })
  it('respects a custom prior', () => {
    expect(bayesianScore(10, 1, 7, 1)).toBeCloseTo(8.5, 3) // (1*7+10)/2
  })
})
