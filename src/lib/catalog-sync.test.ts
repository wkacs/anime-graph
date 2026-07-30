import { describe, it, expect } from 'vitest'
import { nextPageVars, sleepMsFor, sliceNewMedia, defaultWatermark, nextWatermark } from './catalog-sync'

describe('nextPageVars', () => {
  it('passes page and perPage through', () => {
    expect(nextPageVars(3, 50)).toEqual({ page: 3, perPage: 50 })
  })
})

describe('sleepMsFor', () => {
  it('does not sleep when budget is healthy', () => {
    expect(sleepMsFor(60, 60)).toBe(0)
  })
  it('spreads remaining reset window when budget is low', () => {
    // 2 requests left, 30s to reset -> ~15000ms each
    expect(sleepMsFor(2, 30)).toBe(15000)
  })
  it('caps at the reset window when exhausted', () => {
    expect(sleepMsFor(0, 20)).toBe(20000)
  })
})

const m = (updatedAt: number) => ({ updatedAt })

describe('sliceNewMedia', () => {
  it('csak a vízjelnél frissebb elemek jönnek vissza', () => {
    const { fresh, morePages } = sliceNewMedia([m(300), m(200), m(100)], 200)
    expect(fresh).toEqual([m(300)])
    expect(morePages).toBe(false)
  })

  it('ha a lap legrégebbi eleme is frissebb, lapozni kell tovább', () => {
    const { fresh, morePages } = sliceNewMedia([m(300), m(250)], 200)
    expect(fresh).toEqual([m(300), m(250)])
    expect(morePages).toBe(true)
  })

  it('üres lapra nincs továbblapozás', () => {
    expect(sliceNewMedia([], 200)).toEqual({ fresh: [], morePages: false })
  })

  it('a vízjellel egyenlő elem már nem friss (zárt határ)', () => {
    const { fresh, morePages } = sliceNewMedia([m(200)], 200)
    expect(fresh).toEqual([])
    expect(morePages).toBe(false)
  })
})

describe('defaultWatermark', () => {
  it('első futáskor 3 napra néz vissza', () => {
    expect(defaultWatermark(1_000_000)).toBe(1_000_000 - 3 * 86_400)
  })
})

describe('nextWatermark', () => {
  it('a lap legfrissebb eleme lép be, de sosem csökken', () => {
    expect(nextWatermark(500, [m(700), m(600)])).toBe(700)
    expect(nextWatermark(900, [m(700)])).toBe(900)
    expect(nextWatermark(500, [])).toBe(500)
  })
})
