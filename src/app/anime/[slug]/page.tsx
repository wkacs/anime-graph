import { redirect, notFound } from 'next/navigation'
import CatalogTitlePage from '@/components/CatalogTitlePage'
import { legacyRedirectTarget } from '@/lib/catalog-page'

export const revalidate = 86400
export const dynamicParams = true

// No build-time prerender: with ~20k+ titles, prerendering top-N here means one
// Neon query per page at build (too slow). All pages render on first request and
// are then ISR-cached. Re-enable a small top-by-popularity prerender once traffic
// data makes it worthwhile.
export function generateStaticParams() {
  return []
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
