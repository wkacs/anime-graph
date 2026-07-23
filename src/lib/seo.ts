// SEO-segédek a katalógus-oldalakhoz (M2c): abszolút URL, meta-leírás, JSON-LD.

import { stripHtml } from './description'
import type { TitleRow } from './catalog-page'

export function siteUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export function metaDescription(t: Pick<TitleRow, 'description' | 'titleRomaji' | 'mediaType' | 'year' | 'genres'>): string {
  const base = stripHtml(t.description ?? '') || ''
  if (base) return base.length > 158 ? `${base.slice(0, 155).trimEnd()}…` : base
  const kind = t.mediaType === 'MANGA' ? 'manga' : 'anime'
  const genres = t.genres.slice(0, 3).join(', ')
  return `${t.titleRomaji} (${t.year ?? ''} ${kind})${genres ? ` — ${genres}` : ''} adatlap: pontszámok, ajánlások, ízlés-egyezés.`
}

// generateMetadata-hoz közös objektum (Next Metadata-kompatibilis alakban)
export function titleMetadata(t: TitleRow, canonicalPathStr: string) {
  const url = `${siteUrl()}${canonicalPathStr}`
  const description = metaDescription(t)
  const pageTitle = `${t.titleRomaji} — ${t.mediaType === 'MANGA' ? 'manga' : 'anime'} | Anime Graph`
  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: pageTitle,
      description,
      url,
      type: 'website' as const,
      ...(t.coverUrl ? { images: [{ url: t.coverUrl }] } : {}),
    },
    twitter: {
      card: 'summary' as const,
      title: pageTitle,
      description,
      ...(t.coverUrl ? { images: [t.coverUrl] } : {}),
    },
  }
}

// JSON-LD <script>-be ágyazáshoz: a `<` escape-elése nélkül egy third-party
// (AniList-szinkronból jövő) cím/leírás `</script>`-tel XSS-t nyithatna.
export function jsonLdScript(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

const MOVIE_FORMATS = new Set(['MOVIE'])

// schema.org: anime → TVSeries/Movie (format szerint), manga → Book
export function buildTitleJsonLd(t: TitleRow, canonicalUrl: string): Record<string, unknown> {
  const common: Record<string, unknown> = {
    '@context': 'https://schema.org',
    name: t.titleRomaji,
    url: canonicalUrl,
    ...(t.titleEnglish && t.titleEnglish !== t.titleRomaji ? { alternateName: t.titleEnglish } : {}),
    ...(t.coverUrl ? { image: t.coverUrl } : {}),
    ...(t.description ? { description: metaDescription(t) } : {}),
    ...(t.genres.length ? { genre: t.genres } : {}),
  }
  if (t.avgScore != null) {
    common.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round(t.avgScore) / 10,
      bestRating: 10,
      worstRating: 1,
      ratingCount: Math.max(1, t.communityCount),
    }
  }
  if (t.mediaType === 'MANGA') {
    return { ...common, '@type': 'Book', bookFormat: 'https://schema.org/GraphicNovel' }
  }
  if (MOVIE_FORMATS.has(t.format ?? '')) {
    return { ...common, '@type': 'Movie' }
  }
  return {
    ...common,
    '@type': 'TVSeries',
    ...(t.episodes != null ? { numberOfEpisodes: t.episodes } : {}),
    ...(t.year != null ? { startDate: String(t.year) } : {}),
  }
}
