import { describe, it, expect } from 'vitest'
import { parseFacts, buildExtractMessages } from './extract'

describe('parseFacts', () => {
  it('accepts a valid facts payload', () => {
    const raw = '```json\n{"facts":[{"kind":"like","text":"a time-travel plot végig feszes volt"},{"kind":"dislike","text":"lassú első 6 rész"}]}\n```'
    expect(parseFacts(raw)).toEqual([
      { kind: 'like', text: 'a time-travel plot végig feszes volt' },
      { kind: 'dislike', text: 'lassú első 6 rész' },
    ])
  })

  it('rejects wrong kind values', () => {
    expect(() => parseFacts('{"facts":[{"kind":"love","text":"xx xx"}]}')).toThrow()
  })

  it('rejects empty facts array', () => {
    expect(() => parseFacts('{"facts":[]}')).toThrow()
  })
})

describe('buildExtractMessages', () => {
  it('includes title and opinion in the user message', () => {
    const msgs = buildExtractMessages('Steins;Gate', 'nagyon tetszett a vége')
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].content).toContain('Steins;Gate')
    expect(msgs[1].content).toContain('nagyon tetszett a vége')
  })
})
