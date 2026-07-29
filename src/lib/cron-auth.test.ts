import { describe, expect, it } from 'vitest'
import { authorizeCron } from './cron-auth'

describe('authorizeCron', () => {
  it('fails closed when the secret is absent', () => {
    expect(authorizeCron(undefined, null)).toBe('misconfigured')
    expect(authorizeCron('', 'Bearer anything')).toBe('misconfigured')
  })

  it('only accepts the exact bearer token', () => {
    expect(authorizeCron('secret', null)).toBe('unauthorized')
    expect(authorizeCron('secret', 'Bearer wrong')).toBe('unauthorized')
    expect(authorizeCron('secret', 'Bearer secret')).toBe('ok')
  })
})
