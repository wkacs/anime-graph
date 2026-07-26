import { describe, it, expect } from 'vitest'
import { pickHero, type HeroMine, type HeroSeason } from './home-hero'

const NOW = 1_800_000_000

function mine(over: Partial<HeroMine> = {}): HeroMine {
  return {
    animeId: 1, anilistId: 101, title: 'A', coverUrl: null,
    status: 'watching', progress: 3, episodes: 12,
    airingAt: NOW + 3600, nextEpisode: 4,
    ...over,
  }
}

function season(over: Partial<HeroSeason> = {}): HeroSeason {
  return { anilistId: 201, title: 'S', coverUrl: null, tasteScore: null, ...over }
}

describe('pickHero', () => {
  it('1. az adasba kerulo cim nyer', () => {
    const p = pickHero([mine()], [season({ tasteScore: 99 })], NOW)
    expect(p.kind).toBe('airing')
    if (p.kind === 'airing') expect(p.item.animeId).toBe(1)
  })

  it('1. a legkorabbi JOVOBELI adas nyer', () => {
    const p = pickHero(
      [
        mine({ animeId: 1, airingAt: NOW + 7200 }),
        mine({ animeId: 2, airingAt: NOW + 600 }),
        mine({ animeId: 3, airingAt: NOW + 3600 }),
      ],
      [], NOW,
    )
    expect(p.kind).toBe('airing')
    if (p.kind === 'airing') expect(p.item.animeId).toBe(2)
  })

  it('1. a mar lement adas nem szamit', () => {
    const p = pickHero([mine({ animeId: 1, airingAt: NOW - 10, status: 'completed' })], [], NOW)
    expect(p.kind).not.toBe('airing')
  })

  it('2. jovobeli adas nelkul a legelorehaladottabb nezett cim', () => {
    const p = pickHero(
      [
        mine({ animeId: 1, airingAt: NOW - 10, progress: 2 }),
        mine({ animeId: 2, airingAt: NOW - 10, progress: 9 }),
      ],
      [], NOW,
    )
    expect(p.kind).toBe('watching')
    if (p.kind === 'watching') expect(p.item.animeId).toBe(2)
  })

  it('2. egyenlo progressnel a kisebb animeId (determinisztikus)', () => {
    const p = pickHero(
      [
        mine({ animeId: 7, airingAt: NOW - 10, progress: 5 }),
        mine({ animeId: 3, airingAt: NOW - 10, progress: 5 }),
      ],
      [], NOW,
    )
    expect(p.kind).toBe('watching')
    if (p.kind === 'watching') expect(p.item.animeId).toBe(3)
  })

  it('2. csak a watching statuszut valasztja', () => {
    const p = pickHero(
      [mine({ animeId: 1, airingAt: NOW - 10, status: 'completed', progress: 12 })],
      [season({ anilistId: 55, tasteScore: 60 })], NOW,
    )
    expect(p.kind).toBe('discover')
  })

  it('3. ures lista: a legjobb taste-pontszamu szezon-cim', () => {
    const p = pickHero(
      [],
      [
        season({ anilistId: 1, tasteScore: 40 }),
        season({ anilistId: 2, tasteScore: 88 }),
        season({ anilistId: 3, tasteScore: null }),
      ],
      NOW,
    )
    expect(p.kind).toBe('discover')
    if (p.kind === 'discover') {
      expect(p.item.anilistId).toBe(2)
      expect(p.score).toBe(88)
    }
  })

  it('3. taste-pontszam nelkul a lokalis fit-map dont', () => {
    const p = pickHero(
      [],
      [season({ anilistId: 1 }), season({ anilistId: 2 })],
      NOW,
      { 1: 30, 2: 77 },
    )
    expect(p.kind).toBe('discover')
    if (p.kind === 'discover') {
      expect(p.item.anilistId).toBe(2)
      expect(p.score).toBe(77)
    }
  })

  it('3. a taste-pontszam eronyerte a fit-becslessel szemben', () => {
    const p = pickHero(
      [],
      [season({ anilistId: 1, tasteScore: 51 }), season({ anilistId: 2 })],
      NOW,
      { 2: 95 },
    )
    if (p.kind === 'discover') expect(p.item.anilistId).toBe(1)
  })

  it('3. pontszam nelkul az elso szezon-cim, score null', () => {
    const p = pickHero([], [season({ anilistId: 9 })], NOW)
    expect(p.kind).toBe('discover')
    if (p.kind === 'discover') {
      expect(p.item.anilistId).toBe(9)
      expect(p.score).toBeNull()
    }
  })

  it('4. minden ures -> empty', () => {
    expect(pickHero([], [], NOW).kind).toBe('empty')
  })
})
