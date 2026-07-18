import { NextRequest, NextResponse } from 'next/server'
import { searchAnime } from '@/lib/anilist'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })
  try {
    return NextResponse.json({ results: await searchAnime(q) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
