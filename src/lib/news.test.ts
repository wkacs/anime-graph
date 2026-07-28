import { describe, it, expect } from 'vitest'
import { formatCountdown, weekdayIndexBudapest, type CountdownUnits } from './news'

const HU: CountdownUnits = { soon: 'hamarosan', day: 'n', hour: 'ó', minute: 'p' }
const EN: CountdownUnits = { soon: 'soon', day: 'd', hour: 'h', minute: 'm' }

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
    expect(formatCountdown(3 * 86400 + 5 * 3600 + 120, HU)).toBe('3n 5ó')
  })

  it('shows hours and minutes under a day', () => {
    expect(formatCountdown(5 * 3600 + 42 * 60, HU)).toBe('5ó 42p')
  })

  it('shows minutes under an hour', () => {
    expect(formatCountdown(17 * 60 + 30, HU)).toBe('17p')
  })

  it('shows soon at or below zero', () => {
    expect(formatCountdown(0, HU)).toBe('hamarosan')
    expect(formatCountdown(-500, HU)).toBe('hamarosan')
  })

  it('a mertekegyseget a hivo adja, igy a visszaszamlalo forditható', () => {
    // Ez a lenyeg: ugyanaz a szamitas, mas nyelven — a lib nem tud a nyelvrol.
    expect(formatCountdown(3 * 86400 + 5 * 3600, EN)).toBe('3d 5h')
    expect(formatCountdown(0, EN)).toBe('soon')
  })
})
