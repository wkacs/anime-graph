import { describe, it, expect } from 'vitest'
import { canonicalPath, pickSourceRelation } from './catalog-page'

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

describe('pickSourceRelation', () => {
  const rels = [
    { type: 'SEQUEL', anilistId: 2, title: 'S2' },
    { type: 'SOURCE', anilistId: 10, title: 'Manga' },
    { type: 'ADAPTATION', anilistId: 20, title: 'Anime' },
  ]
  it('ANIME oldalon a SOURCE', () => {
    expect(pickSourceRelation(rels, 'ANIME')?.anilistId).toBe(10)
  })
  it('MANGA oldalon az ADAPTATION', () => {
    expect(pickSourceRelation(rels, 'MANGA')?.anilistId).toBe(20)
  })
  it('nincs talalat -> null', () => {
    expect(pickSourceRelation([{ type: 'SEQUEL', anilistId: 2, title: 'S2' }], 'ANIME')).toBeNull()
  })
})
