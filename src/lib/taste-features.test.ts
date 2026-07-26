import { describe, it, expect } from 'vitest'
import { lengthBand, eraOf, titleFeatureKeys, type FeatureSource } from './taste-features'

const base: FeatureSource = {
  genres: ['Sci-Fi', 'Drama'], tags: [{ name: 'Time Manipulation' }],
  format: 'TV', episodes: 24, chapters: null, year: 2011,
  studio: 'White Fox', mediaType: 'ANIME',
  relations: [{ type: 'SOURCE', anilistId: 1, title: 'VN' }],
}

describe('lengthBand', () => {
  it('anime savok epizodszam szerint', () => {
    expect(lengthBand({ ...base, episodes: 12 })).toBe('short')
    expect(lengthBand({ ...base, episodes: 24 })).toBe('standard')
    expect(lengthBand({ ...base, episodes: 64 })).toBe('long')
    expect(lengthBand({ ...base, episodes: 1000 })).toBe('endless')
  })
  it('manga savok fejezetszam szerint', () => {
    const m = { ...base, mediaType: 'MANGA', episodes: null }
    expect(lengthBand({ ...m, chapters: 20 })).toBe('short')
    expect(lengthBand({ ...m, chapters: 80 })).toBe('standard')
    expect(lengthBand({ ...m, chapters: 250 })).toBe('long')
    expect(lengthBand({ ...m, chapters: 900 })).toBe('endless')
  })
  it('adat nelkul nincs sav', () => {
    expect(lengthBand({ ...base, episodes: null })).toBeNull()
  })
})

describe('eraOf', () => {
  it('evtizedre kerekit', () => {
    expect(eraOf(2011)).toBe('2010s')
    expect(eraOf(1999)).toBe('1990s')
  })
  it('null ev nincs korszak', () => { expect(eraOf(null)).toBeNull() })
})

describe('titleFeatureKeys', () => {
  it('minden tengelyt kisbetus kulccsa kepez', () => {
    const keys = titleFeatureKeys(base)
    expect(keys).toContain('g:sci-fi')
    expect(keys).toContain('t:time manipulation')
    expect(keys).toContain('format:tv')
    expect(keys).toContain('length:standard')
    expect(keys).toContain('era:2010s')
    expect(keys).toContain('studio:white fox')
  })
  it('hianyzo mezo nem ad kulcsot', () => {
    const keys = titleFeatureKeys({ ...base, studio: null, year: null, format: null })
    expect(keys.some((k) => k.startsWith('studio:'))).toBe(false)
    expect(keys.some((k) => k.startsWith('era:'))).toBe(false)
    expect(keys.some((k) => k.startsWith('format:'))).toBe(false)
  })
  it('nincs duplikatum', () => {
    const keys = titleFeatureKeys({ ...base, genres: ['Sci-Fi', 'Sci-Fi'] })
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('SOURCE relacio adaptaciot jelol, enelkul original', () => {
    expect(titleFeatureKeys(base)).toContain('source:adaptation')
    expect(titleFeatureKeys({ ...base, relations: [] })).toContain('source:original')
  })
})
