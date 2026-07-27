import { describe, expect, it } from 'vitest'
import { formatMetric, THIN_SPACE, type LeaderRow } from './leaderboard-metric'

const base: LeaderRow = {
  rank: 1, id: 1, slug: 'x', mediaType: 'ANIME', titleRomaji: 'X',
  coverUrl: null, genres: [], avgScore: null,
  communityScore: null, communityCount: 0, popularity: 0,
}

// A lib nyelvfuggetlen: a mertekegyseg FAJTAJAT adja vissza, nem forditott
// szoveget. Igy ugyanez a logika szolgal ki minden nyelvet.
describe('formatMetric', () => {
  it('anilist: a szazalek jelzese unit-tipuskent jon', () => {
    expect(formatMetric({ ...base, avgScore: 91 }, 'anilist')).toEqual({ value: '91', unit: 'percent' })
  })

  it('sajat: egy tizedes + a pontozok szama kulon mezoben', () => {
    expect(formatMetric({ ...base, communityScore: 8.42, communityCount: 12 }, 'sajat'))
      .toEqual({ value: '8.4', unit: 'raters', count: 12 })
  })

  it('sajat: egyetlen pontozo is helyes szamot ad', () => {
    expect(formatMetric({ ...base, communityScore: 7, communityCount: 1 }, 'sajat'))
      .toEqual({ value: '7.0', unit: 'raters', count: 1 })
  })

  it('nepszeru: ezres tagolas keskeny nem-toro szokozzel', () => {
    expect(formatMetric({ ...base, popularity: 1240 }, 'nepszeru'))
      .toEqual({ value: `1${THIN_SPACE}240`, unit: 'lists' })
  })

  it('milliós nagysagrendben ket tagolo kerul be', () => {
    expect(formatMetric({ ...base, popularity: 1234567 }, 'nepszeru').value)
      .toBe(`1${THIN_SPACE}234${THIN_SPACE}567`)
  })

  // A tagolo NEM sima szokoz lehet: az sortorest engedne a szamon belul.
  it('a tagolo karakter U+202F, nem U+0020', () => {
    expect(THIN_SPACE.codePointAt(0)).toBe(0x202f)
    expect(formatMetric({ ...base, popularity: 1240 }, 'nepszeru').value.codePointAt(1)).toBe(0x202f)
  })

  it('nepszeru: ezer alatt nincs tagolas', () => {
    expect(formatMetric({ ...base, popularity: 7 }, 'nepszeru')).toEqual({ value: '7', unit: 'lists' })
  })

  it('hianyzo adat: sima kotojel, nincs mertekegyseg', () => {
    expect(formatMetric(base, 'anilist')).toEqual({ value: '-', unit: 'none' })
    expect(formatMetric(base, 'sajat')).toEqual({ value: '-', unit: 'none' })
  })

  it('a nulla popularitas ervenyes ertek, nem hianyzo adat', () => {
    expect(formatMetric({ ...base, popularity: 0 }, 'nepszeru')).toEqual({ value: '0', unit: 'lists' })
  })

  it('a lib nem ad vissza forditott szoveget', () => {
    const osszes = [
      formatMetric({ ...base, avgScore: 91 }, 'anilist'),
      formatMetric({ ...base, communityScore: 8, communityCount: 3 }, 'sajat'),
      formatMetric({ ...base, popularity: 12 }, 'nepszeru'),
    ]
    for (const m of osszes) {
      expect(['percent', 'raters', 'lists', 'none']).toContain(m.unit)
      expect(m.value).not.toMatch(/[a-zA-Zá-űÁ-Ű]/)
    }
  })
})
