import { describe, it, expect } from 'vitest'
import { toPublicAnime, PUBLIC_ANIME_KEYS } from './public-view'

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
