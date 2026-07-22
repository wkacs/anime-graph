import { describe, it, expect } from 'vitest'
import { estimateCost } from './ai-cost'

describe('estimateCost', () => {
  it('ingyen modellnél 0', () => {
    expect(estimateCost('glm-4.7-flash', 1000, 1000)).toBe(0)
  })
  it('ismeretlen modellnél 0 (nem dob)', () => {
    expect(estimateCost('valami-ismeretlen', 1000, 500)).toBe(0)
  })
  it('árazott modellnél token-arányos', () => {
    // 2000 prompt @ 0.001/1k + 1000 completion @ 0.002/1k = 0.002 + 0.002
    expect(estimateCost('__test-paid', 2000, 1000)).toBeCloseTo(0.004)
  })
})
