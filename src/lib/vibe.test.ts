import { describe, it, expect } from 'vitest'
import { parseVibe, buildVibeMessages } from './vibe'

describe('parseVibe', () => {
  it('parses own and new picks', () => {
    const raw = '{"ownPicks":[{"animeId":1,"reason":"time-travel, ahogy kérted"}],"newPicks":[{"title":"Erased","reason":"rövid és feszes thriller"}]}'
    const out = parseVibe(raw)
    expect(out.ownPicks[0].animeId).toBe(1)
    expect(out.newPicks[0].title).toBe('Erased')
  })

  it('defaults missing arrays to empty', () => {
    expect(parseVibe('{"ownPicks":[{"animeId":2,"reason":"pont ilyen hangulat"}]}').newPicks).toEqual([])
  })

  it('rejects malformed picks', () => {
    expect(() => parseVibe('{"ownPicks":[{"reason":"nincs id itt"}]}')).toThrow()
  })
})

describe('buildVibeMessages', () => {
  it('marks selected anime as highlighted context with facts', () => {
    const msgs = buildVibeMessages(
      'olyat mint a Steins;Gate, de rövidebb',
      [
        { id: 1, title: 'Steins;Gate', genres: ['Sci-Fi'], facts: ['time-travel plot tetszett'], selected: true },
        { id: 2, title: 'FMA:B', genres: ['Action'], facts: [], selected: false },
      ],
      ['gyors tempó tetszik'],
    )
    expect(msgs[1].content).toContain('Kiemelt animék')
    expect(msgs[1].content).toContain('[1] Steins;Gate')
    expect(msgs[1].content).toContain('time-travel plot tetszett')
    expect(msgs[1].content).toContain('gyors tempó tetszik')
  })
})
