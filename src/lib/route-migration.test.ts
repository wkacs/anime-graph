import { describe, expect, it } from 'vitest'
import { internalRoute, legacyRedirect } from './route-migration'

describe('English route migration', () => {
  it('redirects legacy Hungarian paths to canonical English paths', () => {
    expect(legacyRedirect('/bongeszo')).toBe('/browse')
    expect(legacyRedirect('/beallitasok')).toBe('/settings')
  })

  it('rewrites canonical English paths to the existing app routes', () => {
    expect(internalRoute('/browse')).toBe('/bongeszo')
    expect(internalRoute('/settings')).toBe('/beallitasok')
  })
})
