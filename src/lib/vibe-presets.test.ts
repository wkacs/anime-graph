import { describe, it, expect } from 'vitest'
import { VIBE_PRESETS, buildVibePrompt, chipFeatureKeys } from './vibe-presets'

describe('buildVibePrompt', () => {
  it('chipek prompt-darabjai vesszővel fűződnek + custom a végére', () => {
    const out = buildVibePrompt(['mood-dark', 'len-movie'], 'legyen benne zongora')
    expect(out).toContain('sötét')
    expect(out).toContain('film')
    expect(out.endsWith('legyen benne zongora')).toBe(true)
  })
  it('üres bemenet: üres string', () => {
    expect(buildVibePrompt([], '  ')).toBe('')
  })
  it('ismeretlen chip-id kimarad', () => {
    expect(buildVibePrompt(['nincs-ilyen'], '')).toBe('')
  })
  it('minden preset-id egyedi', () => {
    const ids = VIBE_PRESETS.flatMap((g) => g.chips.map((c) => c.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('uj csoportok: helyszin, temak, celkozonseg, forras', () => {
    // A csoport AZONOSITOJA nyelvfuggetlen; a felirat a szotarban ul.
    const groups = VIBE_PRESETS.map((g) => g.groupId)
    for (const g of ['setting', 'themes', 'demographic', 'source']) expect(groups).toContain(g)
  })
  it('uj chipek prompt-darabja is befuzodik', () => {
    const out = buildVibePrompt(['th-isekai', 'demo-seinen'], '')
    expect(out).toContain('isekai')
    expect(out).toContain('seinen')
  })
})

describe('chipFeatureKeys', () => {
  it('mufaj-chip mufaj-kulcsot ad', () => {
    expect(chipFeatureKeys(['g-scifi']).keys).toContain('g:sci-fi')
  })
  it('hossz- es korszak-chip a szarmaztatott tengelyekre kepez', () => {
    expect(chipFeatureKeys(['len-short']).keys).toContain('length:short')
    expect(chipFeatureKeys(['len-movie']).keys).toContain('format:movie')
    expect(chipFeatureKeys(['era-2010s']).keys).toContain('era:2010s')
  })
  it('tema-chip AniList-tagre kepez', () => {
    expect(chipFeatureKeys(['th-timetravel']).keys).toContain('t:time manipulation')
  })
  it('a hangulat es tempo NEM kepezheto — unmapped-be kerul', () => {
    const out = chipFeatureKeys(['mood-dark', 'pace-fast', 'g-action'])
    expect(out.keys).toEqual(['g:action'])
    expect(out.unmapped.sort()).toEqual(['mood-dark', 'pace-fast'])
  })
  it('csak az "eredeti anime" forras-chip kepezheto, a konkret adaptacio-tipusok nem', () => {
    expect(chipFeatureKeys(['src-original']).keys).toEqual(['source:original'])
    expect(chipFeatureKeys(['src-manga']).unmapped).toEqual(['src-manga'])
    expect(chipFeatureKeys(['src-ln']).unmapped).toEqual(['src-ln'])
  })
  it('ismeretlen id nem dob', () => {
    expect(chipFeatureKeys(['nincs-ilyen']).unmapped).toEqual(['nincs-ilyen'])
  })
  it('duplikatumot kiszur', () => {
    expect(chipFeatureKeys(['set-fantasy', 'th-isekai']).keys).toEqual(['t:isekai'])
  })
})
