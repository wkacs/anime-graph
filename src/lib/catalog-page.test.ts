import { describe, it, expect } from 'vitest'
import { canonicalPath } from './catalog-page'

describe('canonicalPath', () => {
  it('routes anime under /anime', () => {
    expect(canonicalPath('ANIME', 'steins-gate-9253')).toBe('/anime/steins-gate-9253')
  })
  it('routes manga under /manga', () => {
    expect(canonicalPath('MANGA', 'berserk-30002')).toBe('/manga/berserk-30002')
  })
  it('treats unknown mediaType as anime', () => {
    expect(canonicalPath('WHATEVER', 'x-1')).toBe('/anime/x-1')
  })
})
