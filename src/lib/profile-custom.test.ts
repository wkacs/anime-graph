import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SECTIONS,
  EMPTY_PROFILE_CUSTOM,
  PROFILE_ACCENTS,
  isAllowedImageUrl,
  sanitizeProfileCustom,
} from './profile-custom'

describe('isAllowedImageUrl', () => {
  it('csak az AniList CDN-t engedi', () => {
    expect(isAllowedImageUrl('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg')).toBe(true)
    expect(isAllowedImageUrl('http://s4.anilist.co/file/x.jpg')).toBe(false)
    expect(isAllowedImageUrl('https://evil.example/s4.anilist.co/x.jpg')).toBe(false)
    expect(isAllowedImageUrl('javascript' + ':alert(1)')).toBe(false)
    expect(isAllowedImageUrl('https://s4.anilist.co/../evil')).toBe(false)
  })
})

describe('sanitizeProfileCustom', () => {
  it('szemét inputból üres, de érvényes profil lesz', () => {
    expect(sanitizeProfileCustom(null)).toEqual(EMPTY_PROFILE_CUSTOM)
    expect(sanitizeProfileCustom('garbage')).toEqual(EMPTY_PROFILE_CUSTOM)
    expect(sanitizeProfileCustom({ avatarUrl: 42, bannerTitleId: 'x', accent: [], favGenres: 'no' }))
      .toEqual(EMPTY_PROFILE_CUSTOM)
  })

  it('displayName: trim, whitespace-összevonás, kontroll-karakterek ki, 40 char cap', () => {
    const bell = String.fromCharCode(7)
    expect(sanitizeProfileCustom({ displayName: `  Kacs${bell}   the   Great  ` }).displayName)
      .toBe('Kacs the Great')
    expect(sanitizeProfileCustom({ displayName: 'x'.repeat(80) }).displayName).toHaveLength(40)
    expect(sanitizeProfileCustom({ displayName: '   ' }).displayName).toBeNull()
  })

  it('avatarUrl: csak whitelistes host marad meg', () => {
    const ok = 'https://s4.anilist.co/file/anilistcdn/character/large/b1-x.png'
    expect(sanitizeProfileCustom({ avatarUrl: ok }).avatarUrl).toBe(ok)
    expect(sanitizeProfileCustom({ avatarUrl: 'https://example.com/a.png' }).avatarUrl).toBeNull()
  })

  it('bannerTitleId: csak pozitív egész', () => {
    expect(sanitizeProfileCustom({ bannerTitleId: 12 }).bannerTitleId).toBe(12)
    expect(sanitizeProfileCustom({ bannerTitleId: -3 }).bannerTitleId).toBeNull()
    expect(sanitizeProfileCustom({ bannerTitleId: 1.5 }).bannerTitleId).toBeNull()
  })

  it('accent: csak a palettából fogad el', () => {
    expect(sanitizeProfileCustom({ accent: PROFILE_ACCENTS[0] }).accent).toBe(PROFILE_ACCENTS[0])
    expect(sanitizeProfileCustom({ accent: '#00ff00' }).accent).toBeNull()
    expect(sanitizeProfileCustom({ accent: 'red' }).accent).toBeNull()
  })

  it('favGenres: dedup, max 5, hossz-cap, nem-string kiszűrve', () => {
    const out = sanitizeProfileCustom({
      favGenres: ['Action', 'Action', ' Drama ', 42, '', 'x'.repeat(30), 'A', 'B', 'C', 'D'],
    }).favGenres
    expect(out).toEqual(['Action', 'Drama', 'A', 'B', 'C'])
  })

  it('sections: hiányzó mezők defaultra, nem-bool eldobva', () => {
    expect(sanitizeProfileCustom({}).sections).toEqual(DEFAULT_SECTIONS)
    expect(sanitizeProfileCustom({ sections: { stats: false, top: 'yes' } }).sections)
      .toEqual({ stats: false, top: true, activity: true })
  })
})
