import { describe, it, expect } from 'vitest'
import { buildMalBody, buildAniListMutation, toMalStatus, toAniListStatus, type ListChange } from './sync-back'

const base: ListChange = { malId: 21, anilistId: 21, mediaType: 'ANIME' }

describe('státusz-térképek', () => {
  it('mind a 4 belső státusz leképezve mindkét providerre', () => {
    for (const s of ['watching', 'completed', 'planned', 'dropped']) {
      expect(toMalStatus[s]).toBeTruthy()
      expect(toAniListStatus[s]).toBeTruthy()
    }
    expect(toMalStatus.planned).toBe('plan_to_watch')
    expect(toAniListStatus.planned).toBe('PLANNING')
  })
})

describe('buildMalBody', () => {
  it('teljes változás → status + epizód + pont', () => {
    expect(buildMalBody({ ...base, status: 'completed', progress: 12, myScore: 9 })).toEqual({
      status: 'completed', num_watched_episodes: '12', score: '9',
    })
  })

  it('pont törlése → score 0 (MAL-konvenció)', () => {
    expect(buildMalBody({ ...base, myScore: null }).score).toBe('0')
  })

  it('üres változás → üres body', () => {
    expect(buildMalBody(base)).toEqual({})
  })
})

describe('buildAniListMutation', () => {
  it('score 1-10 → scoreRaw 10-100', () => {
    const m = buildAniListMutation({ ...base, myScore: 8 })!
    expect(m.variables.scoreRaw).toBe(80)
    expect(m.query).toContain('SaveMediaListEntry')
  })

  it('csak a megadott mezők kerülnek a mutációba', () => {
    const m = buildAniListMutation({ ...base, status: 'watching' })!
    expect(m.variables.status).toBe('CURRENT')
    expect(m.query).not.toContain('progress')
    expect(m.query).not.toContain('scoreRaw')
  })

  it('üres változás → null (nincs felesleges hívás)', () => {
    expect(buildAniListMutation(base)).toBeNull()
  })
})
