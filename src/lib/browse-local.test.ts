import { describe, it, expect } from 'vitest'
import { browseSortColumn, resolveSeason } from './browse-local'

describe('browseSortColumn', () => {
  it('AniList-sort → title-oszlop', () => {
    expect(browseSortColumn('POPULARITY_DESC')).toBe('popularity')
    expect(browseSortColumn('SCORE_DESC')).toBe('score')
    expect(browseSortColumn('START_DATE_DESC')).toBe('year')
    expect(browseSortColumn('ismeretlen')).toBe('popularity') // default
  })
})

describe('resolveSeason', () => {
  it('current', () => {
    expect(resolveSeason('current', new Date('2026-07-24T12:00:00Z'))).toEqual({ season: 'SUMMER', year: 2026 })
  })
  it('next atfordul evvalton', () => {
    expect(resolveSeason('next', new Date('2026-11-05T12:00:00Z'))).toEqual({ season: 'WINTER', year: 2027 })
  })
  it('next even belul', () => {
    expect(resolveSeason('next', new Date('2026-07-24T12:00:00Z'))).toEqual({ season: 'FALL', year: 2026 })
  })
  it('undefined -> null', () => {
    expect(resolveSeason(undefined, new Date('2026-07-24T12:00:00Z'))).toBeNull()
  })
})
