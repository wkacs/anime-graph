import { describe, it, expect } from 'vitest'
import { newToken, hashToken, tokenExpiry, isTokenUsable } from './auth-token'

describe('newToken', () => {
  it('URL-biztos es eleg hosszu', () => {
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{32,}$/)
  })
  it('ket hivas kulonbozo tokent ad', () => {
    expect(newToken()).not.toBe(newToken())
  })
})

describe('hashToken', () => {
  it('determinisztikus sha256 hex', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).toHaveLength(64)
  })
  it('mas input mas hash', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })
})

describe('tokenExpiry', () => {
  const now = new Date('2026-07-26T12:00:00Z')
  it('verify = 24 ora', () => {
    expect(tokenExpiry('verify', now).toISOString()).toBe('2026-07-27T12:00:00.000Z')
  })
  it('reset = 1 ora', () => {
    expect(tokenExpiry('reset', now).toISOString()).toBe('2026-07-26T13:00:00.000Z')
  })
})

describe('isTokenUsable', () => {
  const now = new Date('2026-07-26T12:00:00Z')
  it('ervenyes es hasznalatlan → true', () => {
    expect(isTokenUsable({ expiresAt: new Date('2026-07-26T13:00:00Z'), usedAt: null }, now)).toBe(true)
  })
  it('lejart → false', () => {
    expect(isTokenUsable({ expiresAt: new Date('2026-07-26T11:00:00Z'), usedAt: null }, now)).toBe(false)
  })
  it('mar hasznalt → false', () => {
    expect(isTokenUsable(
      { expiresAt: new Date('2026-07-26T13:00:00Z'), usedAt: new Date('2026-07-26T11:00:00Z') },
      now,
    )).toBe(false)
  })
})
