// Sitemap-darabolás (M2c): index + ≤45k URL-es gyerek-sitemapek (Google-plafon 50k).

export const SITEMAP_CHUNK_SIZE = 45_000

export function sitemapChunkCount(totalUrls: number): number {
  if (totalUrls <= 0) return 0
  return Math.ceil(totalUrls / SITEMAP_CHUNK_SIZE)
}

export function sitemapChunkBounds(chunk: number): { limit: number; offset: number } {
  return { limit: SITEMAP_CHUNK_SIZE, offset: chunk * SITEMAP_CHUNK_SIZE }
}

export function sitemapIndexXml(siteUrl: string, chunkCount: number): string {
  const items = Array.from({ length: chunkCount }, (_, i) =>
    `<sitemap><loc>${siteUrl}/sitemaps/${i}</loc></sitemap>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`
}

export type SitemapEntry = { path: string; lastmod: Date | null }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function sitemapXml(siteUrl: string, entries: SitemapEntry[]): string {
  const items = entries.map((e) =>
    `<url><loc>${esc(`${siteUrl}${e.path}`)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`
}
