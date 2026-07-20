import { describe, it, expect } from 'vitest'
import { nextPageVars, sleepMsFor } from './catalog-sync'

describe('nextPageVars', () => {
  it('passes page and perPage through', () => {
    expect(nextPageVars(3, 50)).toEqual({ page: 3, perPage: 50 })
  })
})

describe('sleepMsFor', () => {
  it('does not sleep when budget is healthy', () => {
    expect(sleepMsFor(60, 60)).toBe(0)
  })
  it('spreads remaining reset window when budget is low', () => {
    // 2 requests left, 30s to reset -> ~15000ms each
    expect(sleepMsFor(2, 30)).toBe(15000)
  })
  it('caps at the reset window when exhausted', () => {
    expect(sleepMsFor(0, 20)).toBe(20000)
  })
})
