import { describe, expect, it } from 'vitest'
import { canViewProfile, profileVisibility } from './profile-visibility'

describe('profileVisibility', () => {
  it('defaults legacy and malformed values to public', () => {
    expect(profileVisibility(undefined)).toBe('public')
    expect(profileVisibility('invalid')).toBe('public')
    expect(profileVisibility('private')).toBe('private')
  })

  it('only exposes private data to its owner', () => {
    expect(canViewProfile(4, 4, 'private')).toBe(true)
    expect(canViewProfile(4, 5, 'private')).toBe(false)
    expect(canViewProfile(null, 5, 'private')).toBe(false)
    expect(canViewProfile(4, 5, 'public')).toBe(true)
  })
})
