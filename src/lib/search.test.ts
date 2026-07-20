import { describe, it, expect } from 'vitest'
import { rankBlend } from './search'

describe('rankBlend', () => {
  it('adds a small popularity boost to the text rank', () => {
    // popularity 9999 -> log10(10000)=4 -> +0.2
    expect(rankBlend(0.5, 9999)).toBeCloseTo(0.7, 5)
  })
  it('is monotonic in popularity for equal text rank', () => {
    expect(rankBlend(0.5, 1000)).toBeGreaterThan(rankBlend(0.5, 10))
  })
  it('a strong text match beats a weak match on a popular title', () => {
    // strong text 0.9 unpopular vs weak text 0.4 very popular
    expect(rankBlend(0.9, 0)).toBeGreaterThan(rankBlend(0.4, 100000))
  })
  it('handles zero popularity without NaN', () => {
    expect(rankBlend(0.3, 0)).toBeCloseTo(0.3, 5)
  })
})
