import { describe, it, expect } from 'vitest'
import {PRIMARY_TABS, MORE_TABS, MOBILE_TABS, MOBILE_MORE_TABS,
  isTabActive, isNavHidden, isMoreActive, isMobileMoreActive, isFooterHidden } from './nav'

describe('nav szerkezet', () => {
  it('5 elsodleges es 7 tovabbi tab', () => {
    expect(PRIMARY_TABS).toHaveLength(5)
    expect(MORE_TABS).toHaveLength(7)
  })

  it('egy href nem szerepel ket helyen', () => {
    const all = [...PRIMARY_TABS, ...MORE_TABS].map((t) => t.href)
    expect(new Set(all).size).toBe(all.length)
  })

  it('a mobil sav 4 napi-hasznalatu tabot ad, benne a graffal', () => {
    expect(MOBILE_TABS.map((t) => t.href)).toEqual(['/', '/list', '/browse', '/graph'])
  })

  it('a mobil tabok az elsodlegesek kozul valok (ugyanaz az objektum)', () => {
    for (const t of MOBILE_TABS) expect(PRIMARY_TABS).toContain(t)
  })

  it('a mobil Tovabb menu pontosan azt hozza, ami nem fert a savba', () => {
    const inBar = new Set(MOBILE_TABS.map((t) => t.href))
    const inMore = MOBILE_MORE_TABS.map((t) => t.href)
    // a velemenyek kontextualis muvelet lett, ezert innen erheto el
    expect(inMore).toContain('/reviews')
    for (const href of inBar) expect(inMore).not.toContain(href)
    for (const t of MORE_TABS) expect(inMore).toContain(t.href)
    expect(new Set(inMore).size).toBe(inMore.length)
  })

  it('minden elsodleges tab elerheto mobilon is', () => {
    const reachable = new Set([...MOBILE_TABS, ...MOBILE_MORE_TABS].map((t) => t.href))
    for (const t of PRIMARY_TABS) expect(reachable.has(t.href)).toBe(true)
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

  // Asztalon mind az ot elsodleges tab kint van, ezert a velemenyek NEM jeloli
  // a legordulot; mobilon viszont a Tovabb menubol nyilik, ott jelolnie kell.
  it('a velemenyek csak a mobil Tovabb-ot jeloli', () => {
    expect(isMoreActive('/reviews')).toBe(false)
    expect(isMobileMoreActive('/reviews')).toBe(true)
  })

  it('a mobil savban levo tab egyiket sem jeloli', () => {
    expect(isMobileMoreActive('/graph')).toBe(false)
    expect(isMobileMoreActive('/list')).toBe(false)
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
