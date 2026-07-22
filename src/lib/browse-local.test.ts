import { describe, it, expect } from 'vitest'
import { browseSortColumn } from './browse-local'

describe('browseSortColumn', () => {
  it('AniList-sort → title-oszlop', () => {
    expect(browseSortColumn('POPULARITY_DESC')).toBe('popularity')
    expect(browseSortColumn('SCORE_DESC')).toBe('score')
    expect(browseSortColumn('START_DATE_DESC')).toBe('year')
    expect(browseSortColumn('ismeretlen')).toBe('popularity') // default
  })
})
