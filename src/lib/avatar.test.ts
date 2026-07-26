import { describe, it, expect } from 'vitest'
import { avatarInitials, avatarHue } from './avatar'

describe('avatarInitials', () => {
  it('egyszavas nevbol az elso ket betu, nagybetuvel', () => {
    expect(avatarInitials('kacs')).toBe('KA')
  })
  it('elvalasztott nevbol ket kezdobetu', () => {
    expect(avatarInitials('anime_graph')).toBe('AG')
    expect(avatarInitials('anime-graph')).toBe('AG')
  })
  it('egykarakteres nev', () => {
    expect(avatarInitials('k')).toBe('K')
  })
  it('ures nev nem dob', () => {
    expect(avatarInitials('')).toBe('?')
    expect(avatarInitials('---')).toBe('?')
  })
})

describe('avatarHue', () => {
  it('determinisztikus', () => {
    expect(avatarHue('kacs')).toBe(avatarHue('kacs'))
  })
  it('0 es 359 kozott van', () => {
    for (const n of ['a', 'kacs', 'anime-graph', 'zzz', '']) {
      expect(avatarHue(n)).toBeGreaterThanOrEqual(0)
      expect(avatarHue(n)).toBeLessThan(360)
    }
  })
  it('kulonbozo nevek jellemzoen mas szint kapnak', () => {
    expect(avatarHue('kacs')).not.toBe(avatarHue('demo'))
  })
})
