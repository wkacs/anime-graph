import { describe, it, expect } from 'vitest'
import {PRIMARY_TABS, MORE_TABS, MOBILE_TABS,
  isTabActive, isNavHidden, isMoreActive, isFooterHidden } from './nav'

describe('nav szerkezet', () => {
  it('5 elsodleges es 7 tovabbi tab', () => {
    expect(PRIMARY_TABS).toHaveLength(5)
    expect(MORE_TABS).toHaveLength(7)
  })

  it('egy href nem szerepel ket helyen', () => {
    const all = [...PRIMARY_TABS, ...MORE_TABS].map((t) => t.href)
    expect(new Set(all).size).toBe(all.length)
  })

  it('a mobil sav 4 napi-hasznalatu tabot ad', () => {
    expect(MOBILE_TABS.map((t) => t.href)).toEqual(['/', '/list', '/browse', '/reviews'])
  })

  it('a mobil tabok az elsodlegesek kozul valok (ugyanaz az objektum)', () => {
    for (const t of MOBILE_TABS) expect(PRIMARY_TABS).toContain(t)
  })

  it('a velemenyek tab viszi a pending-badge-et', () => {
    const op = PRIMARY_TABS.find((t) => t.href === '/reviews')
    expect(op?.pendingBadge).toBe(true)
  })
})

describe('isTabActive', () => {
  it('a gyoker csak pontos egyezesre aktiv', () => {
    expect(isTabActive('/', '/')).toBe(true)
    expect(isTabActive('/', '/list')).toBe(false)
  })

  it('alutvonalon is aktiv', () => {
    expect(isTabActive('/list', '/list')).toBe(true)
    expect(isTabActive('/list', '/list/5')).toBe(true)
  })

  it('NEM aktiv a csak prefixben egyezo utvonalon', () => {
    // a regi startsWith() ezt tevesen aktivnak jelolte
    expect(isTabActive('/list', '/listing')).toBe(false)
    expect(isTabActive('/versus', '/versusomething')).toBe(false)
  })
})

describe('isNavHidden', () => {
  it('login es publikus megoszto oldalon rejtett', () => {
    expect(isNavHidden('/login')).toBe(true)
    expect(isNavHidden('/p/abc123')).toBe(true)
  })

  it('mashol latszik', () => {
    expect(isNavHidden('/')).toBe(false)
    expect(isNavHidden('/list')).toBe(false)
    expect(isNavHidden('/profil')).toBe(false)
  })
})

describe('isMoreActive', () => {
  it('igaz, ha a Tovabb menu barmelyik tabjan allunk', () => {
    expect(isMoreActive('/vibe')).toBe(true)
    expect(isMoreActive('/statistics')).toBe(true)
    expect(isMoreActive('/wrapped')).toBe(true)
  })

  it('hamis az elsodleges tabokon', () => {
    expect(isMoreActive('/')).toBe(false)
    expect(isMoreActive('/list')).toBe(false)
  })
})

describe('isFooterHidden', () => {
  // A teljes-nezetes oldalak sajat magassagot kezelnek (3D-vaszon, snap-story):
  // ott egy labjegyzet-sav eltolna vagy elvagna a tartalmat.
  it('rejtve a teljes-nezetes oldalakon', () => {
    expect(isFooterHidden('/graph')).toBe(true)
    expect(isFooterHidden('/wrapped')).toBe(true)
  })

  it('rejtve ott is, ahol a nav rejtve van', () => {
    expect(isFooterHidden('/login')).toBe(true)
    expect(isFooterHidden('/p/abc123')).toBe(true)
  })

  it('lathato a normal oldalakon', () => {
    expect(isFooterHidden('/')).toBe(false)
    expect(isFooterHidden('/list')).toBe(false)
    expect(isFooterHidden('/leaderboard')).toBe(false)
    expect(isFooterHidden('/anime/sousou-no-frieren-154587')).toBe(false)
    expect(isFooterHidden('/adatvedelem')).toBe(false)
  })

  it('a grafhoz hasonlo nevu utvonalat nem rejti el tevedesbol', () => {
    expect(isFooterHidden('/graphical')).toBe(false)
  })
})
