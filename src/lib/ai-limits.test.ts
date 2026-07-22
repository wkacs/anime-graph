import { describe, it, expect } from 'vitest'
import { resolveLimit } from './ai-limits'

describe('resolveLimit', () => {
  it('ismert endpoint + free', () => { expect(resolveLimit('recommend', 'free')).toBe(5) })
  it('ismert endpoint + paid', () => { expect(resolveLimit('recommend', 'paid')).toBe(50) })
  it('vibe free', () => { expect(resolveLimit('vibe', 'free')).toBe(10) })
  it('ismeretlen endpoint a default limitre esik', () => {
    expect(resolveLimit('digest', 'free')).toBe(20)
    expect(resolveLimit('digest', 'paid')).toBe(200)
  })
})
