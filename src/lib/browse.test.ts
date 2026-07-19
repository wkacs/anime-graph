import { describe, it, expect } from 'vitest'
import { buildBrowseVariables, randomPage } from './browse'

describe('buildBrowseVariables', () => {
  it('üres szűrők: csak type+sort+page kerül be', () => {
    const v = buildBrowseVariables({ type: 'ANIME', sort: 'POPULARITY_DESC', page: 1 })
    expect(v).toEqual({ type: 'ANIME', sort: 'POPULARITY_DESC', page: 1, perPage: 24 })
  })
  it('anime-évből seasonYear lesz', () => {
    const v = buildBrowseVariables({ type: 'ANIME', sort: 'SCORE_DESC', page: 2, year: 2020 })
    expect(v.seasonYear).toBe(2020)
    expect(v.startDateGreater).toBeUndefined()
  })
  it('manga-évből FuzzyDateInt-tartomány lesz', () => {
    const v = buildBrowseVariables({ type: 'MANGA', sort: 'SCORE_DESC', page: 1, year: 2015 })
    expect(v.startDateGreater).toBe(20150000)
    expect(v.startDateLesser).toBe(20160000)
    expect(v.seasonYear).toBeUndefined()
  })
  it('search/genre/format/minScore átmegy', () => {
    const v = buildBrowseVariables({ type: 'ANIME', sort: 'POPULARITY_DESC', page: 1, search: 'naruto', genre: 'Action', format: 'MOVIE', minScore: 70 })
    expect(v.search).toBe('naruto')
    expect(v.genre).toBe('Action')
    expect(v.format).toBe('MOVIE')
    expect(v.minScore).toBe(70)
  })
})

describe('randomPage', () => {
  it('cap 5000 elemnél: perPage=24-gyel max 208. oldal', () => {
    expect(randomPage(999999, 24, () => 0.9999)).toBe(208)
  })
  it('kis találati halmaz: total szerint', () => {
    expect(randomPage(30, 24, () => 0.9)).toBe(2)
  })
  it('üres: 1', () => {
    expect(randomPage(0, 24, () => 0.5)).toBe(1)
  })
})
