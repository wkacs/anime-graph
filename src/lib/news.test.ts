import { describe, it, expect } from 'vitest'
import { formatCountdown, weekdayIndexBudapest } from './news'

describe('weekdayIndexBudapest', () => {
  it('maps unix seconds to Budapest weekday (0=hétfő)', () => {
    // 2026-07-18 12:00 UTC = szombat Budapesten
    expect(weekdayIndexBudapest(Date.UTC(2026, 6, 18, 12) / 1000)).toBe(5)
    // 2026-07-19 23:30 Budapest (21:30 UTC) még vasárnap
    expect(weekdayIndexBudapest(Date.UTC(2026, 6, 19, 21, 30) / 1000)).toBe(6)
    // 2026-07-19 23:30 UTC = hétfő 01:30 Budapesten (CEST)
    expect(weekdayIndexBudapest(Date.UTC(2026, 6, 19, 23, 30) / 1000)).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('shows days and hours above one day', () => {
    expect(formatCountdown(3 * 86400 + 5 * 3600 + 120)).toBe('3n 5ó')
  })

  it('shows hours and minutes under a day', () => {
    expect(formatCountdown(5 * 3600 + 42 * 60)).toBe('5ó 42p')
  })

  it('shows minutes under an hour', () => {
    expect(formatCountdown(17 * 60 + 30)).toBe('17p')
  })

  it('shows soon at or below zero', () => {
    expect(formatCountdown(0)).toBe('hamarosan')
    expect(formatCountdown(-500)).toBe('hamarosan')
  })
})
