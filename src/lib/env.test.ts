import { afterEach, describe, expect, it, vi } from 'vitest'
import { emailDeliveryConfigured, sessionSecret } from './env'

afterEach(() => vi.unstubAllEnvs())

describe('server environment guards', () => {
  it('ures session secretet minden kornyezetben elutasit', () => {
    vi.stubEnv('SESSION_SECRET', '')
    expect(() => sessionSecret()).toThrow('SESSION_SECRET')
  })

  it('productionben legalabb 32 karakteres session secret kell', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SESSION_SECRET', 'short')
    expect(() => sessionSecret()).toThrow('32')
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32))
    expect(sessionSecret()).toBe('x'.repeat(32))
  })

  it('emailhez a kulcs es a felado egyutt kell', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('FROM_EMAIL', '')
    expect(emailDeliveryConfigured()).toBe(false)
    vi.stubEnv('FROM_EMAIL', 'Anime Graph <hello@example.test>')
    expect(emailDeliveryConfigured()).toBe(true)
  })
})

