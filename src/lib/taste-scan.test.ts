import { describe, it, expect } from 'vitest'
import {
  scanTaste, buildIslands, nicheScore, signatureFeature, ratingBias, topStudio,
  lovesAndAvoids, buildConstellation, pickInsights, entryWeight, MIN_SCAN_SAMPLE,
  isValidAnilistUsername,
  type ScanEntry,
} from './taste-scan'

let nextId = 1
const entry = (over: Partial<ScanEntry> = {}): ScanEntry => ({
  anilistId: nextId++,
  title: `Title ${nextId}`,
  coverUrl: null,
  status: 'COMPLETED',
  score: null,
  genres: ['Action'],
  tags: [],
  studio: null,
  year: 2020,
  averageScore: null,
  popularity: null,
  ...over,
})

const many = (n: number, over: Partial<ScanEntry> = {}) =>
  Array.from({ length: n }, () => entry(over))

describe('entryWeight', () => {
  it('a pont eros jel: 10 pozitiv, 1 negativ', () => {
    expect(entryWeight(entry({ score: 10 }))).toBeGreaterThan(0)
    expect(entryWeight(entry({ score: 1 }))).toBeLessThan(0)
  })

  it('a 0 pont az AniList-nel „nincs pont", nem nulla ertekeles', () => {
    // ha 0 pontnak vennenk, minden pontozatlan befejezett cim erosen negativ lenne
    expect(entryWeight(entry({ score: 0, status: 'COMPLETED' }))).toBeGreaterThan(0)
  })

  it('pont nelkul a statusz dont: dropped negativ, completed pozitiv', () => {
    expect(entryWeight(entry({ status: 'DROPPED' }))).toBeLessThan(0)
    expect(entryWeight(entry({ status: 'COMPLETED' }))).toBeGreaterThan(0)
  })

  it('ismeretlen statusz nem ad jelet', () => {
    expect(entryWeight(entry({ status: 'WHATEVER' }))).toBe(0)
  })
})

describe('buildIslands', () => {
  it('az egyutt jaro mufajokat egy szigetbe olvasztja', () => {
    // ugyanaz a 20 cim mindharom mufajjal — ez egy erdeklodes, nem harom
    const es = many(20, { genres: ['Action', 'Adventure', 'Fantasy'] })
    const islands = buildIslands(es)
    expect(islands).toHaveLength(1)
    expect(islands[0].members.length).toBe(2)
  })

  it('a kulonallo mufajokat kulon szigetnek hagyja', () => {
    const es = [...many(15, { genres: ['Action'] }), ...many(15, { genres: ['Romance'] })]
    const islands = buildIslands(es)
    expect(islands.map((i) => i.name).sort()).toEqual(['Action', 'Romance'])
  })

  it('a zajos, par cimes mufajt nem teszi sziggette', () => {
    const es = [...many(40, { genres: ['Action'] }), entry({ genres: ['Mecha'] })]
    expect(buildIslands(es).map((i) => i.name)).toEqual(['Action'])
  })

  it('a nagy mufajokat nem lancolja egyetlen 99%-os szigette', () => {
    // Action a lista 70%-a; a Comedy nagyresze benne van, a Sports viszont nem.
    // Lancolo osszevonassal a megnott Action a Sportsot is felszivna.
    const es = [
      ...many(40, { genres: ['Action', 'Comedy'] }),
      ...many(30, { genres: ['Action'] }),
      ...many(30, { genres: ['Sports'] }),
    ]
    expect(buildIslands(es).map((i) => i.name)).toEqual(['Action', 'Sports'])
  })

  it('ures listan ures', () => {
    expect(buildIslands([])).toEqual([])
  })

  it('a reszesedes a lista aranyaban all', () => {
    const es = [...many(30, { genres: ['Action'] }), ...many(10, { genres: ['Romance'] })]
    const romance = buildIslands(es).find((i) => i.name === 'Romance')!
    expect(romance.share).toBeCloseTo(0.25, 2)
  })
})

describe('nicheScore', () => {
  it('a nagyon nezett cimek mainstreamnek szamitanak', () => {
    expect(nicheScore(many(10, { popularity: 600_000 }))).toBeLessThan(10)
  })

  it('az alig ismert cimek niche-nek', () => {
    expect(nicheScore(many(10, { popularity: 800 }))).toBeGreaterThan(90)
  })

  it('mediant hasznal, igy ket orias cim nem forgatja fel a listat', () => {
    const es = [...many(18, { popularity: 1000 }), ...many(2, { popularity: 900_000 })]
    expect(nicheScore(es)).toBeGreaterThan(90)
  })

  it('adat nelkul semleges 50', () => {
    expect(nicheScore(many(10))).toBe(50)
  })

  it('a kozossegi PONT nem szamit bele', () => {
    const a = nicheScore(many(10, { popularity: 5000, averageScore: 95 }))
    const b = nicheScore(many(10, { popularity: 5000, averageScore: 40 }))
    expect(a).toBe(b)
  })
})

describe('signatureFeature', () => {
  const tag = (name: string, rank = 80) => ({ name, rank })

  it('azt a taget hozza, ami a jol ertekelt cimekben gyakori, a rosszakban nem', () => {
    const es = [
      ...many(12, { score: 10, tags: [tag('Time Skip')] }),
      ...many(12, { score: 3, tags: [tag('Idol')] }),
    ]
    expect(signatureFeature(es)?.feature).toBe('Time Skip')
  })

  it('a mindket vegen gyakori taget nem tekinti szignaturanak', () => {
    const es = [
      ...many(12, { score: 10, tags: [tag('Male Protagonist')] }),
      ...many(12, { score: 3, tags: [tag('Male Protagonist')] }),
    ]
    expect(signatureFeature(es)).toBeNull()
  })

  it('a gyengen jelolt taget figyelmen kivul hagyja', () => {
    const es = [
      ...many(12, { score: 10, tags: [tag('Time Skip', 20)] }),
      ...many(12, { score: 3, tags: [tag('Idol')] }),
    ]
    expect(signatureFeature(es)).toBeNull()
  })

  it('keves pontozott cim eseten nem allit semmit', () => {
    expect(signatureFeature(many(5, { score: 10, tags: [tag('Time Skip')] }))).toBeNull()
  })
})

describe('ratingBias', () => {
  it('a kozossegnel jelentosen alacsonyabb pontozas: harsh', () => {
    const bias = ratingBias(many(20, { score: 5, averageScore: 80 }))
    expect(bias).toEqual({ direction: 'harsh', delta: 30 })
  })

  it('magasabb pontozas: generous', () => {
    expect(ratingBias(many(20, { score: 9, averageScore: 60 }))?.direction).toBe('generous')
  })

  it('kicsi elteresre nem allit semmit', () => {
    expect(ratingBias(many(20, { score: 7, averageScore: 72 }))).toBeNull()
  })

  it('pontozatlan cimek nem szamitanak bele', () => {
    expect(ratingBias(many(20, { score: null, averageScore: 80 }))).toBeNull()
  })
})

describe('topStudio', () => {
  it('a kedvelt cimek leggyakoribb studiojat hozza', () => {
    const es = [...many(12, { score: 9, studio: 'Bones' }), ...many(4, { score: 9, studio: 'MAPPA' })]
    expect(topStudio(es)).toMatchObject({ studio: 'Bones', count: 12 })
  })

  it('a dobott cimek studiojat nem szamolja kedveltnek', () => {
    const es = [...many(12, { score: 9, studio: 'Bones' }), ...many(20, { status: 'DROPPED', studio: 'MAPPA' })]
    expect(topStudio(es)?.studio).toBe('Bones')
  })

  it('harom cim alatt nem allit studiot', () => {
    const es = many(12, { score: 9, studio: null })
    expect(topStudio(es)).toBeNull()
  })
})

describe('lovesAndAvoids', () => {
  it('a magasra pontozott mufaj kerul a loves-ba, a dobott az avoids-ba', () => {
    const es = [
      ...many(6, { score: 10, genres: ['Psychological'] }),
      ...many(6, { status: 'DROPPED', genres: ['Ecchi'] }),
    ]
    const { loves, avoids } = lovesAndAvoids(es)
    expect(loves).toContain('Psychological')
    expect(avoids).toContain('Ecchi')
  })

  it('egyetlen dobott cim nem tesz egy mufajt keriiltte', () => {
    const es = [...many(6, { score: 10, genres: ['Psychological'] }), entry({ status: 'DROPPED', genres: ['Mecha'] })]
    expect(lovesAndAvoids(es).avoids).not.toContain('Mecha')
  })
})

describe('buildConstellation', () => {
  it('csak a kedvelt cimeket rakja ki', () => {
    const es = [...many(10, { score: 9 }), ...many(10, { status: 'DROPPED' })]
    const { constellation } = buildConstellation(es, buildIslands(es))
    expect(constellation).toHaveLength(10)
  })

  it('egysegnegyzeten belul marad', () => {
    const es = many(30, { score: 8, genres: ['Action', 'Romance'] })
    const { constellation } = buildConstellation(es, buildIslands(es))
    for (const n of constellation) {
      expect(Math.abs(n.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(n.y)).toBeLessThanOrEqual(1)
      expect(n.r).toBeGreaterThan(0)
      expect(n.r).toBeLessThanOrEqual(1)
    }
  })

  it('a jobban kedvelt cim kozelebb kerul a kozephez', () => {
    const es = [entry({ score: 10, anilistId: 1 }), entry({ score: 6, anilistId: 2 }), ...many(10, { score: 8 })]
    const { constellation } = buildConstellation(es, buildIslands(es))
    const d = (id: number) => {
      const n = constellation.find((c) => c.anilistId === id)!
      return Math.hypot(n.x, n.y)
    }
    expect(d(1)).toBeLessThan(d(2))
  })

  it('determinisztikus: ugyanaz a bemenet ugyanazt adja', () => {
    const es = many(20, { score: 8, genres: ['Action', 'Comedy'] })
    const islands = buildIslands(es)
    expect(buildConstellation(es, islands)).toEqual(buildConstellation(es, islands))
  })

  it('el csak kozos mufajok menten keletkezik', () => {
    const es = [...many(5, { score: 9, genres: ['Action', 'Comedy'] }), ...many(5, { score: 9, genres: ['Romance'] })]
    const { edges, constellation } = buildConstellation(es, buildIslands(es))
    for (const [i, j] of edges) {
      expect(constellation[i].island).toBe(constellation[j].island)
    }
  })

  it('nem kedvelt cim nelkul ures', () => {
    expect(buildConstellation(many(10, { status: 'DROPPED' }), [])).toEqual({ constellation: [], edges: [] })
  })
})

describe('pickInsights', () => {
  it('legfeljebb harom allitast ad', () => {
    const es = [
      ...many(20, { score: 10, studio: 'Bones', averageScore: 50, popularity: 900, tags: [{ name: 'Time Skip', rank: 90 }] }),
      ...many(20, { score: 2, studio: 'Bones', averageScore: 50, popularity: 900, genres: ['Romance'] }),
    ]
    expect(pickInsights(es, buildIslands(es)).length).toBeLessThanOrEqual(3)
  })

  it('a szigetek allitasa vezet, mert azt sehol mashol nem latja a user', () => {
    const es = [...many(15, { score: 9, genres: ['Action'] }), ...many(15, { score: 9, genres: ['Romance'] })]
    expect(pickInsights(es, buildIslands(es))[0].kind).toBe('islands')
  })

  it('egyeduralkodo sziget eseten azt jelzi, nem a szigetek szamat', () => {
    const es = [
      ...many(45, { score: 9, genres: ['Action', 'Comedy'] }),
      ...many(4, { score: 9, genres: ['Sports'] }),
    ]
    const first = pickInsights(es, buildIslands(es))[0]
    expect(first).toMatchObject({ kind: 'islands', dominant: 'Action' })
  })

  it('kiegyensulyozott listan nincs dominans sziget', () => {
    const es = [...many(20, { score: 9, genres: ['Action'] }), ...many(20, { score: 9, genres: ['Romance'] })]
    const first = pickInsights(es, buildIslands(es))[0] as { dominant?: string }
    expect(first.dominant).toBeUndefined()
  })

  it('semleges niche-ertekrol nem allit semmit', () => {
    const es = many(20, { score: 8, popularity: 30_000 })
    expect(pickInsights(es, buildIslands(es)).some((i) => i.kind === 'niche')).toBe(false)
  })
})

describe('scanTaste', () => {
  it('a kuszob alatt inkabb semmit nem allit', () => {
    expect(scanTaste(many(MIN_SCAN_SAMPLE - 1, { score: 9 }))).toBeNull()
  })

  it('mufaj nelkuli sorok nem szamitanak bele a mintaba', () => {
    const es = [...many(9, { score: 9 }), ...many(5, { score: 9, genres: [] })]
    expect(scanTaste(es)).toBeNull()
  })

  it('teljes eredmenyt ad eleg adatbol', () => {
    const es = [
      ...many(20, { score: 9, genres: ['Action'], studio: 'Bones', popularity: 200_000, averageScore: 82 }),
      ...many(12, { score: 4, genres: ['Romance'], studio: 'Kyoto Animation', popularity: 150_000, averageScore: 78 }),
    ]
    const res = scanTaste(es)!
    expect(res.sample).toBe(32)
    expect(res.rated).toBe(32)
    expect(res.islands.length).toBeGreaterThanOrEqual(2)
    expect(res.loves).toContain('Action')
    expect(res.constellation.length).toBeGreaterThan(0)
  })
})

describe('isValidAnilistUsername', () => {
  it('elfogadja a szabalyos nevet', () => {
    expect(isValidAnilistUsername('Vendel_92')).toBe(true)
    expect(isValidAnilistUsername('ab')).toBe(true)
  })

  it('elutasit mindent, ami nem fer az alakba', () => {
    expect(isValidAnilistUsername('a')).toBe(false)
    expect(isValidAnilistUsername('a'.repeat(21))).toBe(false)
    expect(isValidAnilistUsername('van szokoz')).toBe(false)
    expect(isValidAnilistUsername('drop--table')).toBe(false)
    expect(isValidAnilistUsername('')).toBe(false)
    expect(isValidAnilistUsername(null)).toBe(false)
    expect(isValidAnilistUsername(42)).toBe(false)
  })

  it('nem enged ujsort a vegere (a $ egysoros regexben csapda)', () => {
    expect(isValidAnilistUsername('valid\n')).toBe(false)
  })
})
