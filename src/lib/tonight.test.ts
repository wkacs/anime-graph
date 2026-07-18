import { describe, it, expect } from 'vitest'
import { pickTonight, type TonightAnime } from './tonight'

const mk = (over: Partial<TonightAnime>): TonightAnime => ({
  id: 1, titleRomaji: 'A', coverUrl: null, status: 'planned',
  episodes: 24, format: 'TV', myScore: null, avgScore: 75, progress: 0, ...over,
})

describe('pickTonight', () => {
  it('folytatas picks a watching anime', () => {
    const rows = [
      mk({ id: 1, status: 'watching', progress: 5 }),
      mk({ id: 2, status: 'planned' }),
    ]
    const pick = pickTonight(rows, 'folytatas', () => 0)
    expect(pick?.id).toBe(1)
    expect(pick?.reason).toContain('rész')
  })

  it('rovid prefers short planned shows or movies', () => {
    const rows = [
      mk({ id: 1, status: 'planned', episodes: 24 }),
      mk({ id: 2, status: 'planned', episodes: 12 }),
      mk({ id: 3, status: 'completed', episodes: 1, format: 'MOVIE' }),
    ]
    const pick = pickTonight(rows, 'rovid', () => 0)
    expect(pick?.id).toBe(2)
  })

  it('comfort picks a high-scored completed anime', () => {
    const rows = [
      mk({ id: 1, status: 'completed', myScore: 9 }),
      mk({ id: 2, status: 'completed', myScore: 5 }),
      mk({ id: 3, status: 'planned' }),
    ]
    const pick = pickTonight(rows, 'comfort', () => 0)
    expect(pick?.id).toBe(1)
  })

  it('barmi falls back across pools and returns null on empty list', () => {
    expect(pickTonight([], 'barmi', () => 0)).toBeNull()
    const pick = pickTonight([mk({ id: 7, status: 'completed', myScore: 9 })], 'barmi', () => 0)
    expect(pick?.id).toBe(7)
  })
})
