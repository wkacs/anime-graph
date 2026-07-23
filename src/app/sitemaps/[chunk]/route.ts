import { dbStatic } from '@/db/client'
import { title } from '@/db/schema'
import { canonicalPath } from '@/lib/catalog-page'
import { siteUrl } from '@/lib/seo'
import { sitemapChunkBounds, sitemapXml } from '@/lib/sitemap-chunks'
import { asc } from 'drizzle-orm'

// Gyerek-sitemap: a title tábla id-rendezett szelete (stabil lapozás), ≤45k URL.
export const revalidate = 86400

export async function GET(_req: Request, ctx: { params: Promise<{ chunk: string }> }) {
  const { chunk } = await ctx.params
  const n = Number(chunk)
  if (!Number.isInteger(n) || n < 0) return new Response('not found', { status: 404 })
  const { limit, offset } = sitemapChunkBounds(n)
  const rows = await dbStatic.select({ slug: title.slug, mediaType: title.mediaType, syncedAt: title.syncedAt })
    .from(title).orderBy(asc(title.id)).limit(limit).offset(offset)
  if (!rows.length) return new Response('not found', { status: 404 })
  const xml = sitemapXml(siteUrl(), rows.map((r) => ({
    path: canonicalPath(r.mediaType, r.slug),
    lastmod: r.syncedAt,
  })))
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
