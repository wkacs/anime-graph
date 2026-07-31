import { describe, it, expect } from 'vitest'
import {
  constantTimeEqual, createSession, verifySession, SESSION_DAYS, SESSION_RENEW_AFTER_MS,
} from './auth'
import { hashPassword, verifyPassword } from './password'

describe('session', () => {
  it('round-trips the user id and token version', async () => {
    const token = await createSession('secret', 42, 3)
    expect(await verifySession('secret', token)).toMatchObject({ userId: 42, tokenVersion: 3 })
  })

  it('a lejarat idopontja is visszajon (a csuszo megujitashoz kell)', async () => {
    const before = Date.now()
    const claims = await verifySession('secret', await createSession('secret', 7, 0, SESSION_DAYS))
    expect(claims!.expiresAt).toBeGreaterThan(before + (SESSION_DAYS - 1) * 86400_000)
  })

  it('rejects tampering and wrong secret', async () => {
    const token = await createSession('secret', 42, 0)
    expect(await verifySession('other', token)).toBeNull()
    expect(await verifySession('secret', token.replace('42', '43'))).toBeNull()
    expect(await verifySession('secret', undefined)).toBeNull()
    expect(await verifySession('secret', 'garbage')).toBeNull()
    expect(await verifySession('', token)).toBeNull()
  })

  it('a regi, 3-reszes token-formatum nem ervenyes', async () => {
    expect(await verifySession('secret', `7.${Date.now() + 86400_000}.abcdef`)).toBeNull()
  })

  it('rejects expired sessions', async () => {
    const token = await createSession('secret', 7, 0, -1) // lejárt tegnap
    expect(await verifySession('secret', token)).toBeNull()
  })

  it('a megujitasi kuszob a felezopont', () => {
    expect(SESSION_RENEW_AFTER_MS).toBe((SESSION_DAYS / 2) * 86400_000)
  })

  it('azonos hosszu alairasokat konstans ideju osszehasonlitoval ellenoriz', () => {
    expect(constantTimeEqual('abcdef', 'abcdef')).toBe(true)
    expect(constantTimeEqual('abcdef', 'abcdeg')).toBe(false)
    expect(constantTimeEqual('short', 'longer')).toBe(false)
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
