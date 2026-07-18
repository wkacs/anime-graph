import { NextRequest, NextResponse } from 'next/server'
import { anilistFetch } from '@/lib/anilist'

const LINKS_QUERY = `
query ($id: Int!) {
  Media(id: $id, type: ANIME) {
    externalLinks { site url type language }
  }
}`

// where to watch: AniList streaming links (hungarian users mostly get the
// international CR/Netflix entries — language field left in for filtering later)
export async function GET(_req: NextRequest, ctx: { params: Promise<{ anilistId: string }> }) {
  const { anilistId } = await ctx.params
  const id = Number(anilistId)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ links: [] })
  try {
    type R = { Media: { externalLinks: { site: string; url: string; type: string; language: string | null }[] | null } }
    const data = await anilistFetch<R>(LINKS_QUERY, { id })
    const links = (data.Media.externalLinks ?? [])
      .filter((l) => l.type === 'STREAMING')
      .map((l) => ({ site: l.site, url: l.url }))
    return NextResponse.json({ links })
  } catch {
    return NextResponse.json({ links: [] })
  }
}
