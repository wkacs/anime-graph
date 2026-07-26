import { describe, it, expect, beforeEach } from 'vitest'
import { __cacheForTest, clearTokenVersionCache, isCacheFresh } from './token-version'

describe('token-version cache', () => {
  beforeEach(() => clearTokenVersionCache())

  it('friss bejegyzest ujrahasznal', () => {
    const now = Date.now()
    expect(isCacheFresh({ version: 2, at: now - 30_000 }, now)).toBe(true)
  })
  it('60 masodpercnel regebbi bejegyzes elavult', () => {
    const now = Date.now()
    expect(isCacheFresh({ version: 2, at: now - 61_000 }, now)).toBe(false)
  })
  it('clearTokenVersionCache uriti a cache-t', () => {
    __cacheForTest.set(1, { version: 5, at: Date.now() })
    clearTokenVersionCache()
    expect(__cacheForTest.size).toBe(0)
  })
  it('egy userre celzott urites csak azt viszi', () => {
    __cacheForTest.set(1, { version: 5, at: Date.now() })
    __cacheForTest.set(2, { version: 5, at: Date.now() })
    clearTokenVersionCache(1)
    expect(__cacheForTest.has(1)).toBe(false)
    expect(__cacheForTest.has(2)).toBe(true)
  })
})
