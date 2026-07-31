import { describe, expect, it } from 'vitest'
import { rateLimitKey } from './rate-limit'

describe('rateLimitKey', () => {
  it('deterministic, scope-fuggo es nem tartalmazza a nyers azonositot', () => {
    const secret = 'test-secret'
    const first = rateLimitKey('login', '198.51.100.12', secret)
    expect(first).toBe(rateLimitKey('login', '198.51.100.12', secret))
    expect(first).not.toContain('198.51.100.12')
    expect(first).not.toBe(rateLimitKey('register', '198.51.100.12', secret))
    expect(first).toMatch(/^rl:login:[0-9a-f]{64}$/)
  })
})
