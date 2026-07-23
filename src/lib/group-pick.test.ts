import { describe, it, expect } from 'vitest'
import { buildTasteVector } from './fit-score'
import { rankGroupPicks, VETO_FIT } from './group-pick'

const item = (genres: string[], myScore: number) => ({ genres, tags: [], status: 'completed', myScore })
const vec = (genres: string[], myScore: number) =>
  buildTasteVector(Array.from({ length: 6 }, () => item(genres, myScore)))

const cand = (name: string, genres: string[]) => ({ name, genres, tags: [] })

describe('rankGroupPicks', () => {
  it('közös kedvenc műfaj a csoport élére kerül', () => {
    const members = [vec(['Action', 'Sci-Fi'], 9), vec(['Action', 'Comedy'], 8)]
    const picks = rankGroupPicks(members, [cand('A', ['Action']), cand('R', ['Romance'])])
    expect(picks[0]?.candidate.name).toBe('A')
    expect(picks.map((p) => p.candidate.name)).not.toContain('R')
  })

  it('vétó: ha egy tagnak kifejezetten nem jönne be, a cím kiesik', () => {
    const lover = vec(['Romance'], 10)
    const hater = buildTasteVector([
      ...Array.from({ length: 4 }, () => item(['Romance'], 1)),
      ...Array.from({ length: 4 }, () => item(['Action'], 9)),
    ])
    const picks = rankGroupPicks([lover, hater], [cand('R', ['Romance'])])
    expect(picks).toHaveLength(0)
  })

  it('perMember tagonkénti fitet ad vissza, groupScore 0-100', () => {
    const members = [vec(['Action'], 9), vec(['Action'], 7)]
    const [pick] = rankGroupPicks(members, [cand('A', ['Action'])])
    expect(pick.perMember).toHaveLength(2)
    expect(pick.groupScore).toBeGreaterThan(50)
    expect(pick.groupScore).toBeLessThanOrEqual(100)
  })

  it('akinek nincs jele a cím feature-eire, az nem húzza le (null, nem vétó)', () => {
    const members = [vec(['Action'], 9), vec(['Action'], 8), vec(['Music'], 8)]
    const picks = rankGroupPicks(members, [cand('A', ['Action'])])
    expect(picks).toHaveLength(1)
    expect(picks[0].perMember[2]).toBeNull()
  })

  it('VETO_FIT exportált és ésszerű', () => {
    expect(VETO_FIT).toBeGreaterThan(0)
    expect(VETO_FIT).toBeLessThan(50)
  })
})
