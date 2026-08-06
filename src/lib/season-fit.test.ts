import { describe, it, expect } from 'vitest'
import { rankSeason, toTasteItems, type SeasonCandidate } from './season-fit'
import type { ScanEntry } from './taste-scan'

const entry = (over: Partial<ScanEntry> = {}): ScanEntry => ({
  anilistId: 1, title: 'A', coverUrl: null, status: 'COMPLETED', score: 9,
  genres: ['Action'], tags: [], studio: null, year: 2020,
  averageScore: null, popularity: null, ...over,
})
const many = (n: number, over: Partial<ScanEntry> = {}) =>
  Array.from({ length: n }, (_, i) => entry({ anilistId: 100 + i, ...over }))

const cand = (over: Partial<SeasonCandidate> = {}): SeasonCandidate => ({
  anilistId: 900, slug: 'x-900', titleRomaji: 'X', titleEnglish: null, coverUrl: null,
  genres: ['Action'], tags: [], ...over,
})

describe('toTasteItems', () => {
  it('az AniList-statuszokat a fit-vektor szokincsere kepezi', () => {
    const items = toTasteItems([entry({ status: 'CURRENT' }), entry({ status: 'DROPPED' })])
    expect(items.map((i) => i.status)).toEqual(['watching', 'dropped'])
  })

  it('a 0 pont „nincs pont", nem nulla ertekeles', () => {
    expect(toTasteItems([entry({ score: 0 })])[0].myScore).toBeNull()
    expect(toTasteItems([entry({ score: 7 })])[0].myScore).toBe(7)
  })

  it('ismeretlen statuszra nem esik szet', () => {
    expect(toTasteItems([entry({ status: 'WHATEVER' })])[0].status).toBe('completed')
  })
})

describe('rankSeason', () => {
  it('a kedvelt mufaj elore kerul', () => {
    const entries = [...many(10, { genres: ['Action'], score: 10 }), ...many(10, { genres: ['Romance'], score: 2 })]
    const picks = rankSeason(entries, [cand({ anilistId: 900, genres: ['Romance'] }), cand({ anilistId: 901, genres: ['Action'] })], 5)
    expect(picks[0].anilistId).toBe(901)
  })

  it('fokozatot is ad, nem csak szamot', () => {
    const picks = rankSeason(many(12, { genres: ['Action'], score: 10 }), [cand()], 5)
    expect(picks[0].tier).toBe('strong')
  })

  it('a listan mar szereplo cimet kihagyja', () => {
    const entries = many(12, { genres: ['Action'], score: 9 })
    const picks = rankSeason(entries, [cand({ anilistId: entries[0].anilistId })], 5)
    expect(picks).toEqual([])
  })

  it('fedezet nelkuli cimet nem tippel meg', () => {
    const entries = many(12, { genres: ['Action'], score: 9 })
    expect(rankSeason(entries, [cand({ genres: ['Mecha'] })], 5)).toEqual([])
  })

  it('tul rovid listan semmit nem allit', () => {
    expect(rankSeason(many(3, { genres: ['Action'], score: 9 }), [cand()], 5)).toEqual([])
  })

  it('tiszteletben tartja a darabszamot', () => {
    const entries = many(12, { genres: ['Action'], score: 9 })
    const cands = Array.from({ length: 20 }, (_, i) => cand({ anilistId: 900 + i }))
    expect(rankSeason(entries, cands, 6)).toHaveLength(6)
  })

  it('determinisztikus: azonos pontszamnal id dont', () => {
    const entries = many(12, { genres: ['Action'], score: 9 })
    const cands = [cand({ anilistId: 902 }), cand({ anilistId: 901 })]
    expect(rankSeason(entries, cands, 2).map((p) => p.anilistId)).toEqual([901, 902])
  })
})
