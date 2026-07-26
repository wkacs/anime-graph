import { describe, expect, it } from 'vitest'
import { buildNlMessages, parseNlResult, type NlItem } from './nl-search'

const item: NlItem = { id: 1, title: 'Gurren Lagann', genres: ['Mecha'], year: 2007, myScore: 9, status: 'completed', mediaType: 'ANIME', opinion: 'zseniális' }

describe('buildNlMessages', () => {
  it('a listát és a kérdést is tartalmazza', () => {
    const msgs = buildNlMessages([item], 'melyik volt a mecha?', 'hu')
    expect(msgs[1].content).toContain('Gurren Lagann')
    expect(msgs[1].content).toContain('melyik volt a mecha?')
  })
})

describe('parseNlResult', () => {
  it('parseol és az érvénytelen id-t kiszűri', () => {
    const raw = '{"matchIds":[1,999],"answer":"A Gurren Lagann volt az."}'
    const out = parseNlResult(raw, new Set([1]))
    expect(out.matchIds).toEqual([1])
    expect(out.answer).toContain('Gurren')
  })

  it('rossz JSON-ra dob', () => {
    expect(() => parseNlResult('nincs json', new Set())).toThrow()
  })
})
