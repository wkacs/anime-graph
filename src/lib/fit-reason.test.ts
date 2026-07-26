import { describe, it, expect } from 'vitest'
import { fitReason } from './fit-reason'

const fit = {
  score: 82,
  top: [{ name: 'Time Manipulation', weight: 0.9 }, { name: 'Sci-Fi', weight: 0.7 }],
  against: [{ name: 'Ecchi', weight: -0.6 }],
}

describe('fitReason', () => {
  it('a mellette szolo feature-oket sorolja fel', () => {
    const r = fitReason(fit, 'hu')
    expect(r).toContain('Time Manipulation')
    expect(r).toContain('Sci-Fi')
  })
  it('az ellene szolot is megemliti', () => {
    expect(fitReason(fit, 'hu')).toContain('Ecchi')
  })
  it('angolul mas a szoveg', () => {
    expect(fitReason(fit, 'en')).not.toBe(fitReason(fit, 'hu'))
  })
  it('ures hozzajarulasnal is ad valamit, nem dob', () => {
    expect(fitReason({ score: 50, top: [], against: [] }, 'hu')).toBeTruthy()
    expect(fitReason({ score: 50, top: [], against: [] }, 'en')).toBeTruthy()
  })
  it('csak ellene szolo eseten is ertelmes', () => {
    const r = fitReason({ score: 20, top: [], against: [{ name: 'Ecchi', weight: -0.9 }] }, 'hu')
    expect(r).toContain('Ecchi')
  })
})
