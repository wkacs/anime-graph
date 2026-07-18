import { describe, it, expect } from 'vitest'
import { compareLists, type MineEntry, type TheirEntry } from './compare'

const mine = (id: number, score: number | null = null): MineEntry => ({
  anilistId: id, title: `M${id}`, coverUrl: null, myScore: score,
})
const theirs = (id: number, score: number | null = null): TheirEntry => ({
  anilistId: id, title: `T${id}`, coverUrl: null, score,
})

describe('compareLists', () => {
  it('computes overlap against the smaller list', () => {
    const r = compareLists(
      [mine(1), mine(2), mine(3), mine(4)],
      [theirs(1), theirs(2)],
    )
    expect(r.commonCount).toBe(2)
    expect(r.overlapPct).toBe(100) // both of their 2 are common
  })

  it('common favorites need high scores on both sides, ordered by sum', () => {
    const r = compareLists(
      [mine(1, 9), mine(2, 10), mine(3, 5)],
      [theirs(1, 8), theirs(2, 9), theirs(3, 10)],
    )
    expect(r.commonFavorites.map((f) => f.anilistId)).toEqual([2, 1])
  })

  it('theyRecommend excludes my titles and sorts by their score', () => {
    const r = compareLists(
      [mine(1)],
      [theirs(1, 10), theirs(2, 7), theirs(3, 9)],
    )
    expect(r.theyRecommend.map((t) => t.anilistId)).toEqual([3, 2])
  })

  it('handles empty their list', () => {
    const r = compareLists([mine(1)], [])
    expect(r.overlapPct).toBe(0)
    expect(r.theyRecommend).toEqual([])
  })
})
