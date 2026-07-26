import { describe, it, expect } from 'vitest'
import { resolveLocale, DEFAULT_LOCALE } from './locale'

describe('resolveLocale', () => {
  it('alapertelmezes angol', () => {
    expect(resolveLocale({})).toBe('en')
    expect(DEFAULT_LOCALE).toBe('en')
  })
  it('a user beallitasa eros a cookie-nal', () => {
    expect(resolveLocale({ cookie: 'en', userLocale: 'hu' })).toBe('hu')
  })
  it('user nelkul a cookie dont', () => {
    expect(resolveLocale({ cookie: 'hu' })).toBe('hu')
  })
  it('cookie nelkul az Accept-Language dont', () => {
    expect(resolveLocale({ acceptLanguage: 'hu-HU,hu;q=0.9,en;q=0.8' })).toBe('hu')
  })
  it('ismeretlen nyelv → angol', () => {
    expect(resolveLocale({ cookie: 'de' })).toBe('en')
    expect(resolveLocale({ acceptLanguage: 'de-DE,de;q=0.9' })).toBe('en')
  })
  it('ervenytelen user-locale nem uti el a cookie-t', () => {
    expect(resolveLocale({ cookie: 'hu', userLocale: 'klingon' })).toBe('hu')
  })
})
