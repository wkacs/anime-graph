import { describe, it, expect } from 'vitest'
import { scoreColor, SCORE_THRESHOLDS } from './score-color'

describe('scoreColor', () => {
  it('fit: a high kuszob felett zold', () => {
    expect(scoreColor(70, 'fit')).toBe('var(--status-watching)')
    expect(scoreColor(99, 'fit')).toBe('var(--status-watching)')
  })

  it('fit: a mid es high kozott semleges', () => {
    expect(scoreColor(45, 'fit')).toBe('var(--text-1)')
    expect(scoreColor(69, 'fit')).toBe('var(--text-1)')
  })

  it('fit: a mid alatt piros', () => {
    expect(scoreColor(44, 'fit')).toBe('var(--status-dropped)')
    expect(scoreColor(0, 'fit')).toBe('var(--status-dropped)')
  })

  it('taste: magasabb kuszobok mint a fit-nel', () => {
    expect(scoreColor(74, 'taste')).toBe('var(--text-1)')
    expect(scoreColor(75, 'taste')).toBe('var(--status-watching)')
    expect(scoreColor(49, 'taste')).toBe('var(--status-dropped)')
  })

  it('kind nelkul fit az alapertelmezes', () => {
    expect(scoreColor(70)).toBe(scoreColor(70, 'fit'))
    expect(scoreColor(50)).toBe(scoreColor(50, 'fit'))
  })

  it('a hatarokon kivuli ertekek nem dobnak', () => {
    expect(scoreColor(-10)).toBe('var(--status-dropped)')
    expect(scoreColor(1000)).toBe('var(--status-watching)')
  })

  it('minden kind-nak van kuszobe es high > mid', () => {
    for (const kind of ['fit', 'taste'] as const) {
      const t = SCORE_THRESHOLDS[kind]
      expect(t.high).toBeGreaterThan(t.mid)
    }
  })
})
