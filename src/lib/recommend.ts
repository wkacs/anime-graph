import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'
import type { RecCandidate } from './anilist'

export const picksSchema = z.object({
  picks: z.array(z.object({
    anilistId: z.number().int(),
    reason: z.string().min(5).max(300),
  })).min(1).max(10),
})

export type RecPick = z.infer<typeof picksSchema>['picks'][number]

const SYSTEM = `Anime-ajánló vagy. A felhasználó ízlés-memóriája és kedvenc animéi alapján
kiválasztod a jelöltlistából az 5-10 legjobban passzoló animét. Minden választáshoz rövid,
SZEMÉLYES magyar indoklást írsz, ami a felhasználó konkrét ízlés-tényeire hivatkozik.
Válaszolj KIZÁRÓLAG JSON-nal: {"picks":[{"anilistId":szám,"reason":"indoklás"}]}
Csak a jelöltlistában szereplő anilistId-ket használhatod.`

export function buildRecommendMessages(
  candidates: RecCandidate[],
  facts: { kind: string; text: string; title: string | null }[],
  topTitles: string[],
): ChatMessage[] {
  const candLines = candidates.map((c) =>
    `[${c.anilistId}] ${c.title} — műfaj: ${c.genres.join(', ')}; AniList-átlag: ${c.avgScore ?? '?'}`,
  ).join('\n')
  const factLines = facts.map((f) =>
    `- (${f.kind}${f.title ? `, ${f.title}` : ''}) ${f.text}`,
  ).join('\n')
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Kedvenc animéim (legjobbra értékelt): ${topTitles.join(', ') || 'nincs még'}\n\n` +
        `Ízlés-memóriám:\n${factLines || '- (még üres)'}\n\nJelöltlista:\n${candLines}`,
    },
  ]
}

export function parsePicks(raw: string): RecPick[] {
  return picksSchema.parse(extractJson(raw)).picks
}
