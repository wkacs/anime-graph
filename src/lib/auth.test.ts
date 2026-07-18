import { describe, it, expect } from 'vitest'
import { createSession, verifySession } from './auth'
import { hashPassword, verifyPassword } from './password'

describe('session', () => {
  it('round-trips the user id', async () => {
    const token = await createSession('secret', 42)
    expect(await verifySession('secret', token)).toBe(42)
  })

  it('rejects tampering and wrong secret', async () => {
    const token = await createSession('secret', 42)
    expect(await verifySession('other', token)).toBeNull()
    expect(await verifySession('secret', token.replace('42', '43'))).toBeNull()
    expect(await verifySession('secret', undefined)).toBeNull()
    expect(await verifySession('secret', 'garbage')).toBeNull()
  })

  it('rejects expired sessions', async () => {
    const token = await createSession('secret', 7, -1) // lejárt tegnap
    expect(await verifySession('secret', token)).toBeNull()
  })
})

describe('password', () => {
  it('verifies the right password and rejects the wrong one', () => {
    const stored = hashPassword('titkos123')
    expect(verifyPassword('titkos123', stored)).toBe(true)
    expect(verifyPassword('rossz', stored)).toBe(false)
  })

  it('salts: same password hashes differently', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'))
  })
})
