import { describe, it, expect } from 'vitest'
import { sessionToken, isValidSession } from './auth'

describe('auth', () => {
  it('produces a stable hex token for a secret', async () => {
    const a = await sessionToken('secret-1')
    const b = await sessionToken('secret-1')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different secrets produce different tokens', async () => {
    expect(await sessionToken('secret-1')).not.toBe(await sessionToken('secret-2'))
  })

  it('validates only the matching token', async () => {
    const t = await sessionToken('s')
    expect(await isValidSession('s', t)).toBe(true)
    expect(await isValidSession('s', t + 'x')).toBe(false)
    expect(await isValidSession('s', undefined)).toBe(false)
  })
})
