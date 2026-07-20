import { describe, it, expect } from 'vitest'
import {
  applySeasonView,
  seasonFacets,
  EMPTY_SEASON_VIEW,
  type SeasonViewItem,
  type SeasonView,
} from './season-filter'

const item = (o: Partial<SeasonViewItem> & { anilistId: number }): SeasonViewItem => ({
  genres: [],
  format: 'TV',
  avgScore: null,
  airingAt: null,
  tasteScore: null,
  streaming: [],
  ...o,
})

const view = (o: Partial<SeasonView> = {}): SeasonView => ({ ...EMPTY_SEASON_VIEW, ...o })

describe('seasonFacets', () => {
  it('collects only present values, deduped and sorted', () => {
    const f = seasonFacets([
      item({ anilistId: 1, genres: ['Drama', 'Action'], format: 'TV', streaming: [{ site: 'Crunchyroll', url: 'x' }] }),
      item({ anilistId: 2, genres: ['Action'], format: 'MOVIE', streaming: [{ site: 'Crunchyroll', url: 'y' }, { site: 'Netflix', url: 'z' }] }),
    ])
    expect(f.genres).toEqual(['Action', 'Drama'])
    expect(f.formats).toEqual(['MOVIE', 'TV'])
    expect(f.sites).toEqual(['Crunchyroll', 'Netflix'])
  })

  it('ignores null formats and missing streaming', () => {
    const f = seasonFacets([item({ anilistId: 1, format: null, streaming: undefined })])
    expect(f.formats).toEqual([])
    expect(f.sites).toEqual([])
  })
})

describe('applySeasonView — sorting', () => {
  it('sorts by taste score desc with unscored items last', () => {
    const out = applySeasonView(
      [
        item({ anilistId: 1, tasteScore: null }),
        item({ anilistId: 2, tasteScore: 40 }),
        item({ anilistId: 3, tasteScore: 90 }),
      ],
      view({ sort: 'taste' }),
    )
    expect(out.map((i) => i.anilistId)).toEqual([3, 2, 1])
  })

  it('breaks taste ties on the original popularity order', () => {
    const out = applySeasonView(
      [item({ anilistId: 1, tasteScore: 70 }), item({ anilistId: 2, tasteScore: 70 })],
      view({ sort: 'taste' }),
    )
    expect(out.map((i) => i.anilistId)).toEqual([1, 2])
  })

  it('sorts by next airing time ascending, non-airing last', () => {
    const out = applySeasonView(
      [
        item({ anilistId: 1, airingAt: null }),
        item({ anilistId: 2, airingAt: 500 }),
        item({ anilistId: 3, airingAt: 100 }),
      ],
      view({ sort: 'airing' }),
    )
    expect(out.map((i) => i.anilistId)).toEqual([3, 2, 1])
  })

  it('sorts by AniList average desc with unrated last', () => {
    const out = applySeasonView(
      [item({ anilistId: 1, avgScore: null }), item({ anilistId: 2, avgScore: 60 }), item({ anilistId: 3, avgScore: 85 })],
      view({ sort: 'score' }),
    )
    expect(out.map((i) => i.anilistId)).toEqual([3, 2, 1])
  })

  it('keeps the incoming order for popularity', () => {
    const out = applySeasonView(
      [item({ anilistId: 7, tasteScore: 10 }), item({ anilistId: 5, tasteScore: 99 })],
      view({ sort: 'popularity' }),
    )
    expect(out.map((i) => i.anilistId)).toEqual([7, 5])
  })

  it('does not mutate the input array', () => {
    const input = [item({ anilistId: 1, tasteScore: 10 }), item({ anilistId: 2, tasteScore: 90 })]
    applySeasonView(input, view({ sort: 'taste' }))
    expect(input.map((i) => i.anilistId)).toEqual([1, 2])
  })
})

describe('applySeasonView — filtering', () => {
  const pool = [
    item({ anilistId: 1, genres: ['Action', 'Comedy'], format: 'TV', tasteScore: 80, streaming: [{ site: 'Crunchyroll', url: 'x' }] }),
    item({ anilistId: 2, genres: ['Drama'], format: 'MOVIE', tasteScore: 55, streaming: [{ site: 'Netflix', url: 'x' }] }),
    item({ anilistId: 3, genres: ['Action'], format: 'ONA', tasteScore: 30, streaming: [] }),
  ]

  it('returns everything with an empty view', () => {
    expect(applySeasonView(pool, view()).length).toBe(3)
  })

  it('ORs values inside the genre dimension', () => {
    const out = applySeasonView(pool, view({ genres: ['Comedy', 'Drama'], sort: 'popularity' }))
    expect(out.map((i) => i.anilistId)).toEqual([1, 2])
  })

  it('ANDs across dimensions', () => {
    const out = applySeasonView(pool, view({ genres: ['Action'], formats: ['ONA'] }))
    expect(out.map((i) => i.anilistId)).toEqual([3])
  })

  it('filters by streaming site', () => {
    const out = applySeasonView(pool, view({ sites: ['Netflix'] }))
    expect(out.map((i) => i.anilistId)).toEqual([2])
  })

  it('drops items below the minimum taste score', () => {
    const out = applySeasonView(pool, view({ minScore: 60, sort: 'popularity' }))
    expect(out.map((i) => i.anilistId)).toEqual([1])
  })

  it('treats an unscored item as below any minimum', () => {
    const out = applySeasonView([item({ anilistId: 9, tasteScore: null })], view({ minScore: 50 }))
    expect(out).toEqual([])
  })

  it('keeps unscored items when the minimum is zero', () => {
    const out = applySeasonView([item({ anilistId: 9, tasteScore: null })], view({ minScore: 0 }))
    expect(out.map((i) => i.anilistId)).toEqual([9])
  })

  it('returns an empty list instead of throwing when nothing matches', () => {
    expect(applySeasonView(pool, view({ genres: ['Horror'] }))).toEqual([])
  })
})
