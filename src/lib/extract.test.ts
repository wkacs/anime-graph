import { describe, it, expect } from 'vitest'
import { parseFacts, buildExtractMessages, parseExtract, filterSignals } from './extract'

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
    const msgs = buildExtractMessages('Steins;Gate', 'nagyon tetszett a vége', 'hu', [])
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].content).toContain('Steins;Gate')
    expect(msgs[1].content).toContain('nagyon tetszett a vége')
  })
  it('a valaszthato jellemzoket is atadja a modellnek', () => {
    const msgs = buildExtractMessages('X', 'y', 'hu', ['g:sci-fi', 't:time manipulation'])
    expect(msgs[1].content).toContain('g:sci-fi')
    expect(msgs[1].content).toContain('t:time manipulation')
  })
})

describe('parseExtract', () => {
  it('tenyeket es jeleket is visszaad', () => {
    const raw = '{"facts":[{"kind":"like","text":"feszes tempo"}],'
      + '"signals":[{"feature":"t:Time Manipulation","polarity":1,"strength":0.8}]}'
    const out = parseExtract(raw)
    expect(out.facts).toHaveLength(1)
    expect(out.signals).toEqual([{ feature: 't:time manipulation', polarity: 1, strength: 0.8 }])
  })
  it('hianyzo signals mezo ures tombot ad (visszafele kompatibilis)', () => {
    expect(parseExtract('{"facts":[{"kind":"like","text":"jo zene"}]}').signals).toEqual([])
  })
})

describe('filterSignals', () => {
  const allowed = ['g:sci-fi', 't:time manipulation', 'length:standard']
  it('a szokeszleten kivuli jelet eldobja', () => {
    const out = filterSignals(
      [{ feature: 't:time manipulation', polarity: 1, strength: 0.8 },
        { feature: 't:kitalalt tag', polarity: 1, strength: 1 }],
      allowed,
    )
    expect(out.map((s) => s.feature)).toEqual(['t:time manipulation'])
  })
  it('a strengthet 0..1 koze szoritja, a polaritast +-1-re', () => {
    const out = filterSignals([{ feature: 'g:sci-fi', polarity: 5, strength: 9 }], allowed)
    expect(out[0]).toEqual({ feature: 'g:sci-fi', polarity: 1, strength: 1 })
  })
  it('nulla strength kiesik — nem hordoz informaciot', () => {
    expect(filterSignals([{ feature: 'g:sci-fi', polarity: 1, strength: 0 }], allowed)).toEqual([])
  })
})
