import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import CatalogTitlePage from '@/components/CatalogTitlePage'
import { canonicalPath, legacyRedirectTarget, resolveTitleBySlug } from '@/lib/catalog-page'
import { titleMetadata } from '@/lib/seo'

export const revalidate = 86400
export const dynamicParams = true

// No build-time prerender: with ~20k+ titles, prerendering top-N here means one
// Neon query per page at build (too slow). All pages render on first request and
// are then ISR-cached. Re-enable a small top-by-popularity prerender once traffic
// data makes it worthwhile.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (/^\d+$/.test(slug)) return {}
  const t = await resolveTitleBySlug('ANIME', slug)
  if (!t || t.isAdult) return { robots: { index: false, follow: false } }
  return titleMetadata(t, canonicalPath(t.mediaType, t.slug))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // legacy numeric /anime/<user_title id> -> 301 to the canonical slug URL.
  // Real slugs always contain letters (`<romaji>-<anilistId>` / `title-<id>`).
  if (/^\d+$/.test(slug)) {
    const target = await legacyRedirectTarget(Number(slug))
    if (!target) notFound()
    redirect(target)
  }
  return <CatalogTitlePage mediaType="ANIME" slug={slug} />
}
