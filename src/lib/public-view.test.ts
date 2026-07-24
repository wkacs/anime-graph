import { describe, it, expect } from 'vitest'
import { toPublicAnime, sortPublicList, PUBLIC_ANIME_KEYS, type PublicAnime } from './public-view'

describe('toPublicAnime', () => {
  it('csak a whitelist-mezőket adja vissza, a privát mezőket levágja', () => {
    const row = {
      titleRomaji: 'Steins;Gate', coverUrl: 'c.jpg', status: 'completed',
      myScore: 10, year: 2011,
      // privát/szivárgó mezők, amiknek SOHA nem szabad kimenniük:
      rawText: 'a titkos véleményem', description: 'hosszú leírás',
      tasteMemory: [{ text: 'like time-travel' }], userId: 1, id: 42,
    }
    const out = toPublicAnime(row as never)
    expect(Object.keys(out).sort()).toEqual([...PUBLIC_ANIME_KEYS].sort())
    expect(out).toEqual({
      title: 'Steins;Gate', coverUrl: 'c.jpg', status: 'completed', myScore: 10, year: 2011,
    })
    // explicit tiltás:
    for (const leaked of ['rawText', 'description', 'tasteMemory', 'userId', 'id']) {
      expect(out).not.toHaveProperty(leaked)
    }
  })
})

describe('sortPublicList', () => {
  const mk = (t: string, s: number | null, y: number | null): PublicAnime =>
    ({ title: t, coverUrl: null, status: 'completed', myScore: s, year: y })
  const list = [mk('B', 7, 2020), mk('A', null, 2024), mk('C', 9, null)]

  it('pont szerint csokkeno, null a vegen', () => {
    expect(sortPublicList(list, 'score').map((a) => a.title)).toEqual(['C', 'B', 'A'])
  })
  it('cim A-Z', () => {
    expect(sortPublicList(list, 'title').map((a) => a.title)).toEqual(['A', 'B', 'C'])
  })
  it('ev csokkeno, null a vegen', () => {
    expect(sortPublicList(list, 'year').map((a) => a.title)).toEqual(['A', 'B', 'C'])
  })
  it('nem mutalja az inputot', () => {
    const before = [...list]
    sortPublicList(list, 'score')
    expect(list).toEqual(before)
  })
})
