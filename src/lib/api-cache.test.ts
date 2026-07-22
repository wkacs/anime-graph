import { describe, it, expect } from 'vitest'
import { isFresh } from './api-cache'

describe('isFresh', () => {
  const now = new Date('2026-07-22T12:00:00Z')
  it('jövőbeli lejárat friss', () => {
    expect(isFresh(new Date('2026-07-22T13:00:00Z'), now)).toBe(true)
  })
  it('múltbeli lejárat lejárt', () => {
    expect(isFresh(new Date('2026-07-22T11:00:00Z'), now)).toBe(false)
  })
  it('null nem friss', () => { expect(isFresh(null, now)).toBe(false) })
})
