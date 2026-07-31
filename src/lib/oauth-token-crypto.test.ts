import { randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  decryptOAuthToken, encryptOAuthToken, isEncryptedOAuthToken,
  oauthTokenEncryptionKey,
} from './oauth-token-crypto'

describe('OAuth token encryption', () => {
  it('AES-GCM roundtrip es veletlen nonce', () => {
    const key = randomBytes(32)
    const first = encryptOAuthToken('sensitive-token', key)
    const second = encryptOAuthToken('sensitive-token', key)
    expect(first).not.toBe(second)
    expect(isEncryptedOAuthToken(first)).toBe(true)
    expect(first).not.toContain('sensitive-token')
    expect(decryptOAuthToken(first, key)).toBe('sensitive-token')
  })

  it('modositott ciphertextet elutasit', () => {
    const key = randomBytes(32)
    const encrypted = encryptOAuthToken('token', key)
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`
    expect(() => decryptOAuthToken(tampered, key)).toThrow('visszafejtése sikertelen')
  })

  it('gordulo migraciohoz a regi plaintext olvashato', () => {
    expect(decryptOAuthToken('legacy-token', randomBytes(32))).toBe('legacy-token')
  })

  it('productionben plaintext tokent nem hasznal', () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect(() => decryptOAuthToken('legacy-token', randomBytes(32)))
        .toThrow('plaintext OAuth-token')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('csak 32 bajtos base64 kulcsot fogad el', () => {
    expect(oauthTokenEncryptionKey(randomBytes(32).toString('base64'))).toHaveLength(32)
    expect(() => oauthTokenEncryptionKey('too-short')).toThrow('32 bájtos')
  })
})
