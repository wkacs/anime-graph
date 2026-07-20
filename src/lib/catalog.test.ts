import { describe, it, expect } from 'vitest'
import { slugify, titleSlug, mapTitle } from './catalog'
import type { AnilistMedia } from './anilist'

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugify('Fullmetal Alchemist: Brotherhood')).toBe('fullmetal-alchemist-brotherhood')
  })
  it('folds accents and trims dashes', () => {
    expect(slugify('  Évángelion!! ')).toBe('evangelion')
  })
  it('never returns empty for non-empty input', () => {
    expect(slugify('★')).toBe('')
  })
})

describe('titleSlug', () => {
  it('appends anilistId for global uniqueness', () => {
    expect(titleSlug('Naruto', 20)).toBe('naruto-20')
  })
})

describe('mapTitle', () => {
  const media: AnilistMedia = {
    id: 5114, type: 'ANIME',
    title: { romaji: 'Hagane no Renkinjutsushi', english: 'FMA: Brotherhood', native: '鋼の錬金術師' },
    coverImage: { large: 'cover.jpg' }, bannerImage: 'banner.jpg',
    genres: ['Action'], tags: [{ name: 'Military', rank: 90 }],
    studios: { nodes: [{ name: 'Bones' }] },
    season: 'SPRING', seasonYear: 2009, episodes: 64, duration: 24, format: 'TV',
    description: 'desc', chapters: null, volumes: null, averageScore: 91,
    trailer: { id: 'abc', site: 'youtube' },
    relations: { edges: [{ relationType: 'PREQUEL', node: { id: 121, type: 'ANIME', title: { romaji: 'X' } } }] },
  }
  it('extracts global metadata with mediaType and slug', () => {
    const t = mapTitle(media)
    expect(t.anilistId).toBe(5114)
    expect(t.mediaType).toBe('ANIME')
    expect(t.slug).toBe('hagane-no-renkinjutsushi-5114')
    expect(t.studio).toBe('Bones')
    expect(t.avgScore).toBe(91)
    expect(t.tags).toEqual([{ name: 'Military', rank: 90 }])
    expect(t.trailerSite).toBe('youtube')
    expect(t.trailerId).toBe('abc')
  })
  it('defaults mediaType to ANIME when type is null', () => {
    expect(mapTitle({ ...media, type: null }).mediaType).toBe('ANIME')
  })
  it('drops non-ANIME relation edges', () => {
    const withMangaRelation: AnilistMedia = {
      ...media,
      relations: {
        edges: [
          { relationType: 'PREQUEL', node: { id: 121, type: 'ANIME', title: { romaji: 'X' } } },
          { relationType: 'ADAPTATION', node: { id: 999, type: 'MANGA', title: { romaji: 'Y' } } },
        ],
      },
    }
    const t = mapTitle(withMangaRelation)
    expect(t.relations).toHaveLength(1)
    expect(t.relations.map((r) => r.anilistId)).toEqual([121])
  })
})
