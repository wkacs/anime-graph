import { describe, it, expect } from 'vitest'
import { buildTasteVector } from './fit-score'
import { compatScore } from './compat'

const item = (genres: string[], myScore: number) => ({ genres, tags: [], status: 'completed', myScore })
const list = (genres: string[], myScore: number, n = 6) => Array.from({ length: n }, () => item(genres, myScore))

describe('compatScore', () => {
  it('azonos ízlés → magas score + közös feature-ök', () => {
    const a = buildTasteVector(list(['Action', 'Sci-Fi'], 9))
    const b = buildTasteVector(list(['Action', 'Sci-Fi'], 8))
    const c = compatScore(a, b)!
    expect(c.score).toBeGreaterThanOrEqual(85)
    expect(c.common).toContain('Action')
  })

  it('ellentétes ízlés (egyik imádja, másik utálja) → alacsony score, nincs közös', () => {
    const a = buildTasteVector(list(['Romance'], 10))
    const b = buildTasteVector(list(['Romance'], 1))
    const c = compatScore(a, b)!
    expect(c.score).toBeLessThanOrEqual(30)
    expect(c.common).toHaveLength(0)
  })

  it('kevés adat bármelyik oldalon → null', () => {
    const a = buildTasteVector(list(['Action'], 9, 2))
    const b = buildTasteVector(list(['Action'], 9))
    expect(compatScore(a, b)).toBeNull()
  })

  it('diszjunkt ízlés-terek → score a középmező alatt, közös üres', () => {
    const a = buildTasteVector(list(['Action'], 9))
    const b = buildTasteVector(list(['Romance'], 9))
    const c = compatScore(a, b)!
    expect(c.common).toHaveLength(0)
    expect(c.score).toBeLessThanOrEqual(55)
  })
})
