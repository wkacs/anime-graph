import { NextRequest, NextResponse } from 'next/server'
import { searchAnime } from '@/lib/anilist'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })
  const type = req.nextUrl.searchParams.get('type') === 'MANGA' ? 'MANGA' as const : 'ANIME' as const
  try {
    return NextResponse.json({ results: await searchAnime(q, type) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
