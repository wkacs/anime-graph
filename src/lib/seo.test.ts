import { describe, it, expect } from 'vitest'
import { buildTitleJsonLd, metaDescription } from './seo'
import { sitemapChunkCount, sitemapChunkBounds, sitemapIndexXml, sitemapXml, SITEMAP_CHUNK_SIZE } from './sitemap-chunks'
import type { TitleRow } from './catalog-page'

const base = {
  id: 1, anilistId: 5114, malId: 5114, slug: 'fma-5114', mediaType: 'ANIME',
  titleRomaji: 'Fullmetal Alchemist', titleEnglish: 'FMA Brotherhood', titleNative: null,
  coverUrl: 'https://x/c.jpg', bannerUrl: null, genres: ['Action', 'Adventure'], tags: [],
  studio: null, season: null, year: 2009, episodes: 64, durationMin: 24, format: 'TV',
  chapters: null, volumes: null, description: '<p>Two brothers &amp; alchemy.</p>',
  relations: [], trailerSite: null, trailerId: null, avgScore: 90, communityScore: null,
  communityCount: 3, popularity: 5, syncedAt: null, searchVector: null, createdAt: new Date(),
} as unknown as TitleRow

describe('buildTitleJsonLd', () => {
  it('TV-anime → TVSeries epizódszámmal + aggregateRating 10-es skálán', () => {
    const ld = buildTitleJsonLd(base, 'https://site/anime/fma-5114')
    expect(ld['@type']).toBe('TVSeries')
    expect(ld.numberOfEpisodes).toBe(64)
    expect((ld.aggregateRating as { ratingValue: number }).ratingValue).toBe(9)
  })

  it('MOVIE format → Movie, manga → Book', () => {
    expect(buildTitleJsonLd({ ...base, format: 'MOVIE' } as TitleRow, 'u')['@type']).toBe('Movie')
    expect(buildTitleJsonLd({ ...base, mediaType: 'MANGA' } as TitleRow, 'u')['@type']).toBe('Book')
  })

  it('score nélkül nincs aggregateRating', () => {
    expect(buildTitleJsonLd({ ...base, avgScore: null } as TitleRow, 'u').aggregateRating).toBeUndefined()
  })
})

describe('jsonLdScript', () => {
  it('a < escape-elve — script-tag-kitörés (XSS) nem lehetséges', async () => {
    const { jsonLdScript } = await import('./seo')
    const out = jsonLdScript({ name: 'x</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script>')
  })
})

describe('metaDescription', () => {
  it('HTML-t leszedi, 158 fölött vág ellipszissel', () => {
    const d = metaDescription({ ...base, description: `<b>${'x'.repeat(300)}</b>` })
    expect(d.length).toBeLessThanOrEqual(158)
    expect(d.endsWith('…')).toBe(true)
    expect(d).not.toContain('<')
  })

  it('leírás nélkül generált fallback cím+műfajokkal', () => {
    const d = metaDescription({ ...base, description: null })
    expect(d).toContain('Fullmetal Alchemist')
    expect(d).toContain('Action')
  })
})

describe('sitemap chunking', () => {
  it('darabszám: 0 → 0, 1 → 1, pontosan a plafon → 1, plafon+1 → 2', () => {
    expect(sitemapChunkCount(0)).toBe(0)
    expect(sitemapChunkCount(1)).toBe(1)
    expect(sitemapChunkCount(SITEMAP_CHUNK_SIZE)).toBe(1)
    expect(sitemapChunkCount(SITEMAP_CHUNK_SIZE + 1)).toBe(2)
  })

  it('bounds: chunk n → offset n*méret', () => {
    expect(sitemapChunkBounds(2)).toEqual({ limit: SITEMAP_CHUNK_SIZE, offset: 2 * SITEMAP_CHUNK_SIZE })
  })

  it('index-xml minden chunkra ad loc-ot', () => {
    const xml = sitemapIndexXml('https://site', 3)
    expect(xml).toContain('/sitemaps/0')
    expect(xml).toContain('/sitemaps/2')
    expect(xml.match(/<sitemap>/g)).toHaveLength(3)
  })

  it('urlset-xml lastmoddal és escape-elt loc-cal', () => {
    const xml = sitemapXml('https://site', [
      { path: '/anime/a&b-1', lastmod: new Date('2026-07-23T10:00:00Z') },
      { path: '/manga/c-2', lastmod: null },
    ])
    expect(xml).toContain('https://site/anime/a&amp;b-1')
    expect(xml).toContain('<lastmod>2026-07-23</lastmod>')
    expect(xml.match(/<url>/g)).toHaveLength(2)
  })
})
