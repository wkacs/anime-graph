import { describe, it, expect } from 'vitest'
import { formatCountdown } from './news'

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
