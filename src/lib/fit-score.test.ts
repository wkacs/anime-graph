import { describe, it, expect } from 'vitest'
import {
  buildTasteVector, computeFit, computeDropRisk, MIN_SAMPLE, MIN_DROP_SAMPLE, SIGNAL_ALPHA,
  fitTier, fitConfidence, relatedCount,
} from './fit-score'

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

describe('computeDropRisk', () => {
  const dropper = [
    ...Array.from({ length: 4 }, () => item({ genres: ['Romance'], tags: [{ name: 'School', rank: 60 }], status: 'dropped' })),
    ...Array.from({ length: 6 }, () => item({ genres: ['Action'], myScore: 9 })),
  ]

  it('kevés droppolt cím (< MIN_DROP_SAMPLE) → null', () => {
    const few = [item({ status: 'dropped' }), ...Array.from({ length: 8 }, () => item({ myScore: 8 }))]
    expect(computeDropRisk(few, { genres: ['Action'], tags: [] })).toBeNull()
  })

  it('droppolt-mintázatú cél → magas rizikó, indokkal', () => {
    const risk = computeDropRisk(dropper, { genres: ['Romance'], tags: [{ name: 'School', rank: 50 }] })!
    expect(risk.score).toBeGreaterThanOrEqual(70)
    expect(risk.top.map((t) => t.name)).toContain('Romance')
  })

  it('droppokkal nem rokon cél → nincs ismert feature → null (nem riogat vakon)', () => {
    expect(computeDropRisk(dropper, { genres: ['Mecha'], tags: [] })).toBeNull()
  })

  it('MIN_DROP_SAMPLE exportált', () => {
    expect(MIN_DROP_SAMPLE).toBeGreaterThanOrEqual(2)
  })
})

// --- szemantikus ag (izles-jelek) ---

const many = Array.from({ length: 10 }, () => ({
  genres: ['Action'], tags: [], status: 'completed', myScore: 8,
}))

describe('szemantikus ag', () => {
  it('jel nelkul a vektor bitre azonos a mai viselkedessel', () => {
    const a = buildTasteVector(many)
    const b = buildTasteVector(many, [])
    expect([...b.vector.entries()]).toEqual([...a.vector.entries()])
  })

  it('a jel uj kulcsot is behozhat, amit a viselkedes nem ismer', () => {
    const v = buildTasteVector(many, [{ feature: 'length:short', polarity: 1, strength: 1 }])
    expect(v.vector.has('length:short')).toBe(true)
  })

  it('negativ jel lehuzza a kulcsot', () => {
    const withSignal = buildTasteVector(many, [{ feature: 'g:action', polarity: -1, strength: 1 }])
    expect(withSignal.vector.get('g:action')!)
      .toBeLessThan(buildTasteVector(many).vector.get('g:action')!)
  })

  it('keves jelnel az alfa aranyosan csokken', () => {
    const few = buildTasteVector(many, [{ feature: 'length:short', polarity: 1, strength: 1 }])
    const lots = buildTasteVector(many, Array.from({ length: 20 }, (_, i) => ({
      feature: i === 0 ? 'length:short' : `t:x${i}`, polarity: 1, strength: 1,
    })))
    expect(lots.vector.get('length:short')!).toBeGreaterThan(few.vector.get('length:short')!)
  })

  it('az alfa a specben rogzitett ertek', () => {
    expect(SIGNAL_ALPHA).toBe(0.4)
  })
})

describe('kibovitett FitTarget', () => {
  it('az uj tengelyek is szamitanak a pontszamban', () => {
    const v = buildTasteVector(many, Array.from({ length: 20 }, () => ({
      feature: 'length:short', polarity: 1, strength: 1,
    })))
    const fit = computeFit(v, { genres: [], tags: [], extraKeys: ['length:short'] })
    expect(fit).not.toBeNull()
    expect(fit!.score).toBeGreaterThan(50)
  })

  it('extraKeys nelkul a viselkedes valtozatlan', () => {
    const v = buildTasteVector(many)
    const a = computeFit(v, { genres: ['Action'], tags: [] })
    const b = computeFit(v, { genres: ['Action'], tags: [], extraKeys: [] })
    expect(a).toEqual(b)
  })
})

describe('fitTier', () => {
  it('a fokozat a kozos fit-kuszobokre ul ra', () => {
    expect(fitTier(78)).toBe('strong')
    expect(fitTier(70)).toBe('strong')
    expect(fitTier(69)).toBe('mixed')
    expect(fitTier(45)).toBe('mixed')
    expect(fitTier(44)).toBe('experimental')
    expect(fitTier(30)).toBe('experimental')
    expect(fitTier(29)).toBe('low')
    expect(fitTier(0)).toBe('low')
  })

  it('a szelso ertekek is ervenyes fokozatot adnak', () => {
    expect(fitTier(100)).toBe('strong')
  })
})

describe('fitConfidence', () => {
  it('nagy lista sok kapcsolodo cimmel: magas', () => {
    expect(fitConfidence(120, 31)).toBe('high')
  })

  it('nagy lista, de alig kapcsolodik barmi: nem magas', () => {
    // 600 shonen mellett egy iyashikei becslese tovabbra is vaktipp
    expect(fitConfidence(600, 2)).toBe('low')
    expect(fitConfidence(600, 6)).toBe('medium')
  })

  it('kis lista sosem ad magasat, meg ha minden kapcsolodik is', () => {
    expect(fitConfidence(12, 12)).toBe('low')
  })

  it('kozepes savban medium', () => {
    expect(fitConfidence(20, 8)).toBe('medium')
  })
})

describe('relatedCount', () => {
  const target = { genres: ['Action'], tags: [{ name: 'Time Skip' }] }

  it('mufaj-egyezest szamol', () => {
    expect(relatedCount([item({ genres: ['Action'] }), item({ genres: ['Romance'] })], target)).toBe(1)
  })

  it('tag-egyezest is szamol', () => {
    const it2 = item({ genres: ['Romance'], tags: [{ name: 'Time Skip' }] })
    expect(relatedCount([it2], target)).toBe(1)
  })

  it('egy cimet csak egyszer szamol, akkor is ha tobb feature egyezik', () => {
    const both = item({ genres: ['Action'], tags: [{ name: 'Time Skip' }] })
    expect(relatedCount([both], target)).toBe(1)
  })

  it('kis- es nagybetu nem szamit', () => {
    expect(relatedCount([item({ genres: ['ACTION'] })], target)).toBe(1)
  })

  it('nulla, ha semmi nem kapcsolodik', () => {
    expect(relatedCount([item({ genres: ['Romance'], tags: [{ name: 'Iyashikei' }] })], target)).toBe(0)
  })
})
