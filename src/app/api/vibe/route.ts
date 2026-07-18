import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, tasteMemory, recommendations } from '@/db/schema'
import { buildVibeMessages, parseVibe, type VibeOwnAnime } from '@/lib/vibe'
import { glmChat } from '@/lib/glm'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const prompt = String(body?.prompt ?? '').trim()
  const animeIds: number[] = Array.isArray(body?.animeIds) ? body.animeIds.map(Number) : []
  if (!prompt && !animeIds.length) {
    return NextResponse.json({ error: 'Írj be egy kérést vagy válassz animét' }, { status: 400 })
  }

  const rows = await db.select().from(anime)
  if (!rows.length) return NextResponse.json({ error: 'Előbb adj hozzá animéket' }, { status: 400 })
  const factRows = await db.select().from(tasteMemory)

  const selectedSet = new Set(animeIds)
  const own: VibeOwnAnime[] = rows.map((r) => ({
    id: r.id,
    title: r.titleRomaji,
    genres: r.genres,
    facts: factRows.filter((f) => f.animeId === r.id).map((f) => `(${f.kind}) ${f.text}`),
    selected: selectedSet.has(r.id),
  }))
  const globalFacts = factRows
    .filter((f) => f.animeId == null || !selectedSet.has(f.animeId))
    .map((f) => `(${f.kind}) ${f.text}`)
    .slice(0, 60)

  try {
    const raw = await glmChat(buildVibeMessages(prompt || 'a kiválasztott animékhez hasonlót keresek', own, globalFacts))
    const parsed = parseVibe(raw)
    const byId = new Map(rows.map((r) => [r.id, r]))
    const ownPicks = parsed.ownPicks
      .filter((p) => byId.has(p.animeId))
      .map((p) => {
        const a = byId.get(p.animeId)!
        return {
          animeId: a.id,
          title: a.titleRomaji,
          coverUrl: a.coverUrl,
          genres: a.genres,
          status: a.status,
          reason: p.reason,
        }
      })
    const result = { ownPicks, newPicks: parsed.newPicks }
    await db.insert(recommendations).values({
      kind: 'vibe',
      input: { prompt, animeIds },
      result,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: `AI-hiba: ${String(e)}` }, { status: 502 })
  }
}
