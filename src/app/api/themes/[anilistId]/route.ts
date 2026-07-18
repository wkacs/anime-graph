import { NextRequest, NextResponse } from 'next/server'
import { fetchThemes } from '@/lib/themes'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ anilistId: string }> }) {
  const { anilistId } = await ctx.params
  const id = Number(anilistId)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ themes: [] })
  }
  try {
    const themes = await fetchThemes(id)
    return NextResponse.json({ themes })
  } catch {
    return NextResponse.json({ themes: [] })
  }
}
