import { describe, it, expect } from 'vitest'
import { parseProfile, buildProfileMessages } from './profile'

describe('parseProfile', () => {
  it('parses portrait and badges', () => {
    const raw = '{"portrait":"Plot-twist vadász vagy, aki a gyors tempót szereti.","badges":["🌀 plot-twist vadász","🎵 openingfüggő","⏱ tempó-fan"]}'
    const p = parseProfile(raw)
    expect(p.portrait).toContain('Plot-twist')
    expect(p.badges).toHaveLength(3)
  })

  it('rejects missing badges', () => {
    expect(() => parseProfile('{"portrait":"Valami hosszabb szöveg ide."}')).toThrow()
  })
})

describe('buildProfileMessages', () => {
  it('includes facts and genres', () => {
    const msgs = buildProfileMessages(['(like) time-travel'], ['Sci-Fi', 'Drama'], ['Steins;Gate'], 42, 'hu')
    expect(msgs[1].content).toContain('time-travel')
    expect(msgs[1].content).toContain('Sci-Fi')
    expect(msgs[1].content).toContain('42')
  })
})
