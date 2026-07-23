import { dbStatic } from '@/db/client'
import { title } from '@/db/schema'
import { siteUrl } from '@/lib/seo'
import { sitemapChunkCount, sitemapIndexXml } from '@/lib/sitemap-chunks'
import { sql } from 'drizzle-orm'

// Sitemap-INDEX: a ~130k katalógus-URL chunkolt gyerek-sitemapekre bontva.
// dbStatic kliens kell (a no-store fetch a cache-elt route-ot 500-ra törné).
export const revalidate = 86400

export async function GET() {
  const [{ c }] = await dbStatic.select({ c: sql<number>`count(*)` }).from(title)
  const xml = sitemapIndexXml(siteUrl(), sitemapChunkCount(Number(c)))
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
