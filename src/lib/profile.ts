import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'

export const profileSchema = z.object({
  portrait: z.string().min(20).max(600),
  badges: z.array(z.string().min(2).max(40)).min(3).max(5),
})

export type TasteProfile = z.infer<typeof profileSchema>

const SYSTEM = `Anime-ízlés elemző vagy. A felhasználó ízlés-memóriája alapján megírod,
ki ő animenézőként. Válaszolj KIZÁRÓLAG JSON-nal:
{"portrait":"2-3 mondatos személyes, találó magyar portré (tegeződve)","badges":["emoji + 2-3 szavas title", …]}
3-5 badge, mindegyik egy emoji + rövid, frappáns magyar címke (pl. "🌀 plot-twist vadász").
Ne általánosíts üresen — a konkrét tényekre építs.`

export function buildProfileMessages(
  facts: string[],
  topGenres: string[],
  topTitles: string[],
  animeCount: number,
): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        `Animék a listámon: ${animeCount}\n` +
        `Top műfajaim: ${topGenres.join(', ') || 'nincs adat'}\n` +
        `Kedvenceim: ${topTitles.join(', ') || 'nincs adat'}\n` +
        `Ízlés-tényeim:\n${facts.map((f) => `- ${f}`).join('\n') || '- (üres)'}`,
    },
  ]
}

export function parseProfile(raw: string): TasteProfile {
  return profileSchema.parse(extractJson(raw))
}
