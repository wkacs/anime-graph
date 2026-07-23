import type { Metadata } from 'next'
import CatalogTitlePage from '@/components/CatalogTitlePage'
import { canonicalPath, resolveTitleBySlug } from '@/lib/catalog-page'
import { titleMetadata } from '@/lib/seo'

export const revalidate = 86400
export const dynamicParams = true

// See /anime/[slug] for why prerendering is disabled: on-demand + ISR-cache.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const t = await resolveTitleBySlug('MANGA', slug)
  if (!t) return {}
  return titleMetadata(t, canonicalPath(t.mediaType, t.slug))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CatalogTitlePage mediaType="MANGA" slug={slug} />
}
