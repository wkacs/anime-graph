import { NextRequest, NextResponse } from 'next/server'
import { searchTitles } from '@/lib/search'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const typeParam = searchParams.get('type')
  const mediaType = typeParam === 'MANGA' ? 'MANGA' : typeParam === 'ANIME' ? 'ANIME' : undefined
  const limit = Number(searchParams.get('limit')) || 20
  const offset = Number(searchParams.get('offset')) || 0
  const hits = await searchTitles(q, { mediaType, limit, offset })
  return NextResponse.json({ hits })
}
