import { describe, expect, it } from 'vitest'
import { buildFeed, type FeedInput } from './feed'

const base: FeedInput = { added: [], opinions: [], episodes: [], favChars: [] }

describe('buildFeed', () => {
  it('kiszűri a saját eseményeket és időrendbe rendez', () => {
    const items = buildFeed({
      ...base,
      added: [
        { userId: 1, username: 'en', animeId: 10, anilistId: 100, title: 'A', mediaType: 'ANIME', status: 'planned', at: '2026-07-10T10:00:00Z' },
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', status: 'watching', at: '2026-07-12T10:00:00Z' },
        { userId: 3, username: 'p', animeId: 12, anilistId: 102, title: 'C', mediaType: 'MANGA', status: 'completed', at: '2026-07-11T10:00:00Z' },
      ],
    }, 1)
    expect(items.map((i) => i.title)).toEqual(['B', 'C'])
    expect(items[0].kind).toBe('added')
  })

  it('napi szinten összevonja egy user egy animéjének epizódjait', () => {
    const items = buildFeed({
      ...base,
      episodes: [
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', episode: 3, at: '2026-07-12T10:00:00Z' },
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', episode: 4, at: '2026-07-12T11:00:00Z' },
        { userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', episode: 5, at: '2026-07-13T09:00:00Z' },
      ],
    }, 1)
    expect(items).toHaveLength(2)
    expect(items[0].count).toBe(1) // 07-13
    expect(items[1].count).toBe(2) // 07-12 összevonva
    expect(items[1].detail).toBe('EP 4') // legutolsó epizód a napon
  })

  it('a vélemény esemény nem szivárogtatja ki a nyers szöveget', () => {
    const items = buildFeed({
      ...base,
      opinions: [{ userId: 2, username: 'o', animeId: 11, anilistId: 101, title: 'B', mediaType: 'ANIME', at: '2026-07-12T10:00:00Z' }],
    }, 1)
    expect(items[0].kind).toBe('opinion')
    expect(items[0].detail).toBeNull()
  })

  it('limitál', () => {
    const added = Array.from({ length: 40 }, (_, i) => ({
      userId: 2, username: 'o', animeId: i, anilistId: i, title: `T${i}`,
      mediaType: 'ANIME', status: 'planned', at: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    }))
    expect(buildFeed({ ...base, added }, 1, 30)).toHaveLength(30)
  })
})
