import { describe, it, expect } from 'vitest'
import { anniversaryYears, buildCapsulePayload } from './time-capsule'

describe('anniversaryYears', () => {
  it('pontos évforduló → évek száma', () => {
    expect(anniversaryYears(new Date('2021-07-23T12:00:00Z'), new Date('2026-07-23T12:00:00Z'))).toBe(5)
  })

  it('nem évforduló nap → null', () => {
    expect(anniversaryYears(new Date('2021-07-22T12:00:00Z'), new Date('2026-07-23T12:00:00Z'))).toBeNull()
  })

  it('idei befejezés (0 év) → null', () => {
    expect(anniversaryYears(new Date('2026-07-23T08:00:00Z'), new Date('2026-07-23T12:00:00Z'))).toBeNull()
  })

  it('budapesti napváltó: UTC 22:30 = másnap Budapesten', () => {
    // 2021-07-22 22:30 UTC = 2021-07-23 00:30 Budapesten → évforduló 07-23-án
    expect(anniversaryYears(new Date('2021-07-22T22:30:00Z'), new Date('2026-07-23T12:00:00Z'))).toBe(5)
  })
})

describe('buildCapsulePayload', () => {
  it('cím + évek + path-url', () => {
    const p = buildCapsulePayload('Steins;Gate', 5, '/anime/steins-gate-9253')
    expect(p.title).toContain('5 éve')
    expect(p.title).toContain('Steins;Gate')
    expect(p.url).toBe('/anime/steins-gate-9253')
  })

  it('path nélkül a főoldalra visz', () => {
    expect(buildCapsulePayload('X', 2, null).url).toBe('/')
  })
})
