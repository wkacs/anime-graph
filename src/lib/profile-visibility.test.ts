import { describe, expect, it } from 'vitest'
import { canViewProfile, profileVisibility } from './profile-visibility'

describe('profileVisibility', () => {
  it('defaults legacy and malformed values to private', () => {
    expect(profileVisibility(undefined)).toBe('private')
    expect(profileVisibility('invalid')).toBe('private')
    expect(profileVisibility('private')).toBe('private')
    expect(profileVisibility('public')).toBe('public')
  })

  it('only exposes private data to its owner', () => {
    expect(canViewProfile(4, 4, 'private')).toBe(true)
    expect(canViewProfile(4, 5, 'private')).toBe(false)
    expect(canViewProfile(null, 5, 'private')).toBe(false)
    expect(canViewProfile(4, 5, 'public')).toBe(true)
    expect(canViewProfile(4, 5, undefined)).toBe(false)
  })
})
