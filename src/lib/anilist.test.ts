import { describe, it, expect } from 'vitest'
import { mapMedia, type AnilistMedia } from './anilist'

const fixture: AnilistMedia = {
  id: 9253,
  type: 'ANIME',
  title: { romaji: 'Steins;Gate', english: 'Steins;Gate', native: 'シュタインズ・ゲート' },
  coverImage: { large: 'https://img.example/cover.jpg' },
  bannerImage: 'https://img.example/banner.jpg',
  description: '<b>El Psy Kongroo.</b>',
  chapters: null,
  volumes: null,
  genres: ['Sci-Fi', 'Thriller'],
  tags: [{ name: 'Time Travel', rank: 95 }, { name: 'Male Protagonist', rank: 60 }],
  studios: { nodes: [{ name: 'White Fox' }] },
  season: 'SPRING',
  seasonYear: 2011,
  episodes: 24,
  duration: 24,
  format: 'TV',
  averageScore: 87,
  trailer: { id: '27OZc-ku6is', site: 'youtube' },
  relations: {
    edges: [
      { relationType: 'SEQUEL', node: { id: 21127, type: 'ANIME', title: { romaji: 'Steins;Gate 0' } } },
      { relationType: 'ADAPTATION', node: { id: 44, type: 'MANGA', title: { romaji: 'ignore me' } } },
    ],
  },
}

describe('mapMedia', () => {
  it('maps AniList media to an anime insert row', () => {
    const row = mapMedia(fixture)
    expect(row.anilistId).toBe(9253)
    expect(row.titleRomaji).toBe('Steins;Gate')
    expect(row.coverUrl).toBe('https://img.example/cover.jpg')
    expect(row.genres).toEqual(['Sci-Fi', 'Thriller'])
    expect(row.studio).toBe('White Fox')
    expect(row.year).toBe(2011)
    expect(row.durationMin).toBe(24)
    expect(row.trailerSite).toBe('youtube')
    expect(row.avgScore).toBe(87)
  })

  it('keeps only ANIME relations', () => {
    const row = mapMedia(fixture)
    expect(row.relations).toEqual([
      { type: 'SEQUEL', anilistId: 21127, title: 'Steins;Gate 0' },
    ])
  })

  it('átveszi a mediaType/description/chapters/volumes mezőket', () => {
    const row = mapMedia({
      ...fixture,
      type: 'MANGA',
      description: '<b>Desc</b>',
      chapters: 120,
      volumes: 12,
      episodes: null,
    })
    expect(row.mediaType).toBe('MANGA')
    expect(row.description).toBe('<b>Desc</b>')
    expect(row.chapters).toBe(120)
    expect(row.volumes).toBe(12)
  })

  it('tolerates missing optional fields', () => {
    const row = mapMedia({
      ...fixture,
      studios: { nodes: [] },
      trailer: null,
      relations: { edges: [] },
      title: { romaji: 'X', english: null, native: null },
    })
    expect(row.studio).toBeNull()
    expect(row.trailerSite).toBeNull()
    expect(row.relations).toEqual([])
  })
})
