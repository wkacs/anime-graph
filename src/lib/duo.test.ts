import { describe, expect, it } from 'vitest'
import { buildDuoCandidates, buildDuoMessages, parseDuoPicks } from './duo'
import type { RecCandidate } from './anilist'

const c = (id: number, title = `T${id}`): RecCandidate =>
  ({ anilistId: id, title, coverUrl: null, genres: ['Action'], avgScore: 80 })

describe('buildDuoCandidates', () => {
  it('közös planned előre, kizártak kiszűrve, dedup', () => {
    const out = buildDuoCandidates({
      myPlanned: [c(1), c(2), c(3)],
      theirPlanned: [c(2), c(4)],
      recPool: [c(5), c(2), c(6), c(1)],
      excludeIds: new Set([6]),
    })
    expect(out[0].anilistId).toBe(2) // mindkettőnk plannedje
    const ids = out.map((x) => x.anilistId)
    expect(ids).not.toContain(6)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('25-re capel', () => {
    const out = buildDuoCandidates({
      myPlanned: Array.from({ length: 30 }, (_, i) => c(i + 1)),
      theirPlanned: [], recPool: Array.from({ length: 30 }, (_, i) => c(i + 100)),
      excludeIds: new Set(),
    })
    expect(out.length).toBeLessThanOrEqual(25)
  })
})

describe('buildDuoMessages', () => {
  it('mindkét user tényeit és nevét tartalmazza', () => {
    const msgs = buildDuoMessages([c(1)], ['szeretem a mechát'], ['utálom a fillert'], 'en', 'o')
    const user = msgs[1].content
    expect(user).toContain('szeretem a mechát')
    expect(user).toContain('utálom a fillert')
    expect(user).toContain('en')
    expect(user).toContain('o')
  })
})

describe('parseDuoPicks', () => {
  it('parseol', () => {
    const raw = '{"picks":[{"anilistId":1,"reason":"mindkettőtöknek jó lesz"}]}'
    expect(parseDuoPicks(raw)).toHaveLength(1)
  })
})
