import { describe, expect, it } from 'vitest'
import { accountExportFilename, canDeleteAccount } from './account'

describe('account deletion confirmation', () => {
  it('requires both a password and the exact destructive confirmation', () => {
    expect(canDeleteAccount('', 'DELETE')).toBe(false)
    expect(canDeleteAccount('password', 'delete')).toBe(false)
    expect(canDeleteAccount('password', 'DELETE')).toBe(true)
  })
})

describe('account export filename', () => {
  it('uses a stable, safe filename', () => {
    expect(accountExportFilename('Kacs Test!', new Date('2026-07-29T12:00:00Z')))
      .toBe('anime-graph-kacs-test--2026-07-29.json')
  })
})
