import { describe, it, expect } from 'vitest'
import { isPublicPath } from './public-paths'

describe('isPublicPath', () => {
  it('a jogi tajekoztatok bejelentkezes nelkul is olvashatok', () => {
    // A regisztracios urlap es a lablec is ezekre linkel: ha auth mogott vannak,
    // olyan feltetelt kell elfogadni, amit a latogato nem tud elolvasni.
    expect(isPublicPath('/aszf')).toBe(true)
    expect(isPublicPath('/adatvedelem')).toBe(true)
  })

  it('a katalogus-wedge publikus marad', () => {
    expect(isPublicPath('/anime/sousou-no-frieren-154587')).toBe(true)
    expect(isPublicPath('/manga/berserk-30002')).toBe(true)
    expect(isPublicPath('/bongeszo')).toBe(true)
    expect(isPublicPath('/toplista')).toBe(true)
    expect(isPublicPath('/u/wkacs')).toBe(true)
    expect(isPublicPath('/sitemap.xml')).toBe(true)
    expect(isPublicPath('/robots.txt')).toBe(true)
  })

  it('a sajat adat vedve marad', () => {
    expect(isPublicPath('/lista')).toBe(false)
    expect(isPublicPath('/beallitasok')).toBe(false)
    expect(isPublicPath('/stats')).toBe(false)
    expect(isPublicPath('/api/opinion')).toBe(false)
    expect(isPublicPath('/api/recommend')).toBe(false)
  })

  it('nem nyit ki hasonlo nevu utvonalat tevedesbol', () => {
    // A prefix-egyezes onmagaban tulloe: az /aszf-tervezet nem a tajekoztato.
    expect(isPublicPath('/aszfalt')).toBe(false)
    expect(isPublicPath('/adatvedelem-belso')).toBe(false)
    expect(isPublicPath('/toplistaim')).toBe(false)
  })
})
