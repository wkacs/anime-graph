import { describe, it, expect } from 'vitest'
import { buildTasteVector, computeFit, MIN_SAMPLE } from './fit-score'

const item = (over: Partial<Parameters<typeof buildTasteVector>[0][number]> = {}) => ({
  genres: ['Action'], tags: [], status: 'completed', myScore: null, ...over,
})

describe('buildTasteVector', () => {
  it('pontszámból előjeles súly: 10 pozitív, 1 negatív', () => {
    const v = buildTasteVector([
      item({ genres: ['Action'], myScore: 10 }),
      item({ genres: ['Horror'], myScore: 1 }),
    ])
    expect(v.vector.get('g:action')!).toBeGreaterThan(0)
    expect(v.vector.get('g:horror')!).toBeLessThan(0)
  })

  it('pont nélkül a státusz ad gyenge jelet: dropped negatív, completed pozitív', () => {
    const v = buildTasteVector([
      item({ genres: ['Romance'], status: 'dropped' }),
      item({ genres: ['Sports'], status: 'completed' }),
    ])
    expect(v.vector.get('g:romance')!).toBeLessThan(0)
    expect(v.vector.get('g:sports')!).toBeGreaterThan(0)
  })

  it('tagek t: prefixszel, kis súllyal kerülnek be', () => {
    const v = buildTasteVector([item({ tags: [{ name: 'Time Travel', rank: 90 }], myScore: 9 })])
    expect(v.vector.has('t:time travel')).toBe(true)
    expect(Math.abs(v.vector.get('t:time travel')!)).toBeLessThanOrEqual(Math.abs(v.vector.get('g:action')!))
  })

  it('sample = listaelemek száma', () => {
    expect(buildTasteVector([item(), item(), item()]).sample).toBe(3)
  })
})

describe('computeFit', () => {
  const likedAction = Array.from({ length: 6 }, () => item({ genres: ['Action'], tags: [{ name: 'Shounen', rank: 80 }], myScore: 9 }))

  it('kevés adat (< MIN_SAMPLE) → null', () => {
    const v = buildTasteVector([item({ myScore: 9 })])
    expect(computeFit(v, { genres: ['Action'], tags: [] })).toBeNull()
  })

  it('egyező ízlés → magas score + top-indok', () => {
    const v = buildTasteVector(likedAction)
    const fit = computeFit(v, { genres: ['Action'], tags: [{ name: 'Shounen', rank: 70 }] })!
    expect(fit.score).toBeGreaterThanOrEqual(75)
    expect(fit.top.map((t) => t.name)).toContain('Action')
  })

  it('ellenkező ízlés (droppolt/lepontozott műfaj) → alacsony score + ellenérv', () => {
    const v = buildTasteVector([
      ...likedAction,
      ...Array.from({ length: 4 }, () => item({ genres: ['Romance'], myScore: 2 })),
    ])
    const fit = computeFit(v, { genres: ['Romance'], tags: [] })!
    expect(fit.score).toBeLessThanOrEqual(35)
    expect(fit.against.map((t) => t.name)).toContain('Romance')
  })

  it('ismeretlen feature-ök kimaradnak; ha nincs elég ismert feature → null (nincs vak tipp)', () => {
    const v = buildTasteVector(likedAction)
    expect(computeFit(v, { genres: ['Mecha'], tags: [{ name: 'Idols', rank: 50 }] })).toBeNull()
  })

  it('score mindig 0-100 közé szorítva', () => {
    const v = buildTasteVector(Array.from({ length: 10 }, () => item({ genres: ['Action'], myScore: 10 })))
    const fit = computeFit(v, { genres: ['Action'], tags: [] })!
    expect(fit.score).toBeLessThanOrEqual(100)
    expect(fit.score).toBeGreaterThanOrEqual(0)
  })

  it('MIN_SAMPLE exportált és ésszerű', () => {
    expect(MIN_SAMPLE).toBeGreaterThanOrEqual(3)
  })
})
