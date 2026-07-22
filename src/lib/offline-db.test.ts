import { describe, it, expect } from 'vitest'
import { parseAnilistId, parseMalId, mapOfflineEntry } from './offline-db'

const entry = {
  sources: ['https://anilist.co/anime/5114', 'https://myanimelist.net/anime/5114'],
  title: 'Fullmetal Alchemist: Brotherhood',
  type: 'TV', episodes: 64, status: 'FINISHED',
  animeSeason: { season: 'SPRING', year: 2009 },
  picture: 'https://cdn/pic.jpg',
  duration: { value: 1440, unit: 'SECONDS' },
  score: { median: 9.1 },
  studios: ['bones'],
  relatedAnime: ['https://anilist.co/anime/9135'],
  tags: ['action', 'military'],
}

describe('parseAnilistId / parseMalId', () => {
  it('kinyeri az AniList és MAL id-t a sources-ból', () => {
    expect(parseAnilistId(entry.sources)).toBe(5114)
    expect(parseMalId(entry.sources)).toBe(5114)
  })
  it('null ha nincs olyan source', () => {
    expect(parseAnilistId(['https://myanimelist.net/anime/1'])).toBeNull()
  })
})

describe('mapOfflineEntry', () => {
  it('AniList-source nélkül null (MAL-only kimarad)', () => {
    expect(mapOfflineEntry({ ...entry, sources: ['https://myanimelist.net/anime/1'] })).toBeNull()
  })
  it('leképez title-oszlopokra, score.median → avgScore ×10', () => {
    const m = mapOfflineEntry(entry)!
    expect(m.anilistId).toBe(5114)
    expect(m.malId).toBe(5114)
    expect(m.titleRomaji).toBe('Fullmetal Alchemist: Brotherhood')
    expect(m.coverUrl).toBe('https://cdn/pic.jpg')
    expect(m.episodes).toBe(64)
    expect(m.season).toBe('SPRING')
    expect(m.year).toBe(2009)
    expect(m.studio).toBe('bones')
    expect(m.avgScore).toBe(91)
    expect(m.durationMin).toBe(24)
    expect(m.relations).toEqual([{ type: 'RELATED', anilistId: 9135, title: '' }])
    expect(m.tags.map((t) => t.name)).toContain('action')
  })
  it('hiányzó animeSeason/score/studios nem dob', () => {
    const m = mapOfflineEntry({ ...entry, animeSeason: undefined, score: undefined, studios: [] })!
    expect(m.season).toBeNull()
    expect(m.year).toBeNull()
    expect(m.avgScore).toBeNull()
    expect(m.studio).toBeNull()
  })
})
