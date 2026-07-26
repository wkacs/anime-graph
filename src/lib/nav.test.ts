import { describe, it, expect } from 'vitest'
import {
  PRIMARY_TABS, MORE_TABS, MOBILE_TABS,
  isTabActive, isNavHidden, isMoreActive,
} from './nav'

describe('nav szerkezet', () => {
  it('5 elsodleges es 5 tovabbi tab', () => {
    expect(PRIMARY_TABS).toHaveLength(5)
    expect(MORE_TABS).toHaveLength(5)
  })

  it('egy href nem szerepel ket helyen', () => {
    const all = [...PRIMARY_TABS, ...MORE_TABS].map((t) => t.href)
    expect(new Set(all).size).toBe(all.length)
  })

  it('a mobil sav 4 napi-hasznalatu tabot ad', () => {
    expect(MOBILE_TABS.map((t) => t.href)).toEqual(['/', '/lista', '/bongeszo', '/velemenyek'])
  })

  it('a mobil tabok az elsodlegesek kozul valok (ugyanaz az objektum)', () => {
    for (const t of MOBILE_TABS) expect(PRIMARY_TABS).toContain(t)
  })

  it('a velemenyek tab viszi a pending-badge-et', () => {
    const op = PRIMARY_TABS.find((t) => t.href === '/velemenyek')
    expect(op?.pendingBadge).toBe(true)
  })
})

describe('isTabActive', () => {
  it('a gyoker csak pontos egyezesre aktiv', () => {
    expect(isTabActive('/', '/')).toBe(true)
    expect(isTabActive('/', '/lista')).toBe(false)
  })

  it('alutvonalon is aktiv', () => {
    expect(isTabActive('/lista', '/lista')).toBe(true)
    expect(isTabActive('/lista', '/lista/5')).toBe(true)
  })

  it('NEM aktiv a csak prefixben egyezo utvonalon', () => {
    // a regi startsWith() ezt tevesen aktivnak jelolte
    expect(isTabActive('/lista', '/listazas')).toBe(false)
    expect(isTabActive('/vs', '/vsomething')).toBe(false)
  })
})

describe('isNavHidden', () => {
  it('login es publikus megoszto oldalon rejtett', () => {
    expect(isNavHidden('/login')).toBe(true)
    expect(isNavHidden('/p/abc123')).toBe(true)
  })

  it('mashol latszik', () => {
    expect(isNavHidden('/')).toBe(false)
    expect(isNavHidden('/lista')).toBe(false)
    expect(isNavHidden('/profil')).toBe(false)
  })
})

describe('isMoreActive', () => {
  it('igaz, ha a Tovabb menu barmelyik tabjan allunk', () => {
    expect(isMoreActive('/vibe')).toBe(true)
    expect(isMoreActive('/stats')).toBe(true)
    expect(isMoreActive('/wrapped')).toBe(true)
  })

  it('hamis az elsodleges tabokon', () => {
    expect(isMoreActive('/')).toBe(false)
    expect(isMoreActive('/lista')).toBe(false)
  })
})
