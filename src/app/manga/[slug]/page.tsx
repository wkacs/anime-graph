import CatalogTitlePage from '@/components/CatalogTitlePage'

export const revalidate = 86400
export const dynamicParams = true

// See /anime/[slug] for why prerendering is disabled: on-demand + ISR-cache.
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CatalogTitlePage mediaType="MANGA" slug={slug} />
}
