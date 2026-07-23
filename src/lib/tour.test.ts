import { describe, it, expect } from 'vitest'
import { tooltipPos, firstVisibleStep, tourKey } from './tour'

const vp = { width: 1000, height: 800 }
const tip = { width: 300, height: 120 }

describe('tooltipPos', () => {
  it('alap: a cél alá, vízszintesen középre', () => {
    const p = tooltipPos({ top: 100, left: 400, width: 200, height: 50 }, tip, vp)
    expect(p.top).toBe(162)
    expect(p.left).toBe(350)
  })

  it('alul nincs hely → a cél fölé fordul', () => {
    const p = tooltipPos({ top: 700, left: 400, width: 200, height: 60 }, tip, vp)
    expect(p.top).toBe(700 - 120 - 12)
  })

  it('vízszintes clamp: bal/jobb szélen nem lóg ki', () => {
    expect(tooltipPos({ top: 100, left: 0, width: 40, height: 40 }, tip, vp).left).toBe(12)
    expect(tooltipPos({ top: 100, left: 960, width: 40, height: 40 }, tip, vp).left).toBe(1000 - 300 - 12)
  })
})

describe('firstVisibleStep', () => {
  const steps = [
    { selector: 'a', title: '', text: '' },
    { selector: 'b', title: '', text: '' },
    { selector: 'c', title: '', text: '' },
  ]

  it('hiányzó cél-elemet átugrik', () => {
    expect(firstVisibleStep(steps, (s) => s !== 'a')).toBe(1)
    expect(firstVisibleStep(steps, (s) => s === 'c', 1)).toBe(2)
  })

  it('ha semmi nem látszik → null', () => {
    expect(firstVisibleStep(steps, () => false)).toBeNull()
  })
})

describe('tourKey', () => {
  it('oldalanként egyedi, prefixelt kulcs', () => {
    expect(tourKey('news')).toBe('anime-graph-tour:news')
  })
})
