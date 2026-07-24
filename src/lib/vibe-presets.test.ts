import { describe, it, expect } from 'vitest'
import { VIBE_PRESETS, buildVibePrompt } from './vibe-presets'

describe('buildVibePrompt', () => {
  it('chipek prompt-darabjai vesszővel fűződnek + custom a végére', () => {
    const out = buildVibePrompt(['mood-dark', 'len-movie'], 'legyen benne zongora')
    expect(out).toContain('sötét')
    expect(out).toContain('film')
    expect(out.endsWith('legyen benne zongora')).toBe(true)
  })
  it('üres bemenet: üres string', () => {
    expect(buildVibePrompt([], '  ')).toBe('')
  })
  it('ismeretlen chip-id kimarad', () => {
    expect(buildVibePrompt(['nincs-ilyen'], '')).toBe('')
  })
  it('minden preset-id egyedi', () => {
    const ids = VIBE_PRESETS.flatMap((g) => g.chips.map((c) => c.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('uj csoportok: helyszin, temak, celkozonseg, forras', () => {
    const groups = VIBE_PRESETS.map((g) => g.group)
    for (const g of ['Helyszín', 'Témák', 'Célközönség', 'Forrás']) expect(groups).toContain(g)
  })
  it('uj chipek prompt-darabja is befuzodik', () => {
    const out = buildVibePrompt(['th-isekai', 'demo-seinen'], '')
    expect(out).toContain('isekai')
    expect(out).toContain('seinen')
  })
})
