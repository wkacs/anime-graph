import type { ChatMessage } from './glm'
import type { RecCandidate } from './anilist'
import { parsePicks, type RecPick } from './recommend'

export type DuoPool = {
  myPlanned: RecCandidate[]
  theirPlanned: RecCandidate[]
  recPool: RecCandidate[]
  excludeIds: Set<number>
}

// sorrend: mindkettőnk planned → az egyikünk planned → AniList-rec pool; dedup + cap 25
export function buildDuoCandidates(pool: DuoPool): RecCandidate[] {
  const theirIds = new Set(pool.theirPlanned.map((c) => c.anilistId))
  const both = pool.myPlanned.filter((c) => theirIds.has(c.anilistId))
  const ordered = [...both, ...pool.myPlanned, ...pool.theirPlanned, ...pool.recPool]
  const seen = new Set<number>()
  const out: RecCandidate[] = []
  for (const c of ordered) {
    if (pool.excludeIds.has(c.anilistId) || seen.has(c.anilistId)) continue
    seen.add(c.anilistId)
    out.push(c)
    if (out.length >= 25) break
  }
  return out
}

const SYSTEM = `Közös anime-est tanácsadó vagy. KÉT felhasználó ízlés-memóriája alapján
kiválasztod a jelöltlistából az 5 animét, ami MINDKETTŐJÜKNEK élmény lenne. Minden
választáshoz rövid magyar indoklást írsz, ami MINDKÉT fél ízlésére kitér
("neked azért..., neki azért...").
Válaszolj KIZÁRÓLAG JSON-nal: {"picks":[{"anilistId":szám,"reason":"indoklás"}]}
Pontosan 5 pick, csak a jelöltlistában szereplő anilistId-kkel.`

export function buildDuoMessages(
  candidates: RecCandidate[],
  myFacts: string[],
  theirFacts: string[],
  myName: string,
  theirName: string,
): ChatMessage[] {
  const candLines = candidates.map((c) =>
    `[${c.anilistId}] ${c.title} — műfaj: ${c.genres.join(', ')}; AniList-átlag: ${c.avgScore ?? '?'}`,
  ).join('\n')
  const facts = (fs: string[]) => (fs.length ? fs.map((f) => `- ${f}`).join('\n') : '- (üres)')
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `${myName} ízlése:\n${facts(myFacts)}\n\n${theirName} ízlése:\n${facts(theirFacts)}\n\nJelöltlista:\n${candLines}`,
    },
  ]
}

export function parseDuoPicks(raw: string): RecPick[] {
  return parsePicks(raw)
}
