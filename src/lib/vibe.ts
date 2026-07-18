import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'

export const vibeSchema = z.object({
  ownPicks: z.array(z.object({
    animeId: z.number().int(),
    reason: z.string().min(5).max(300),
  })).max(8).default([]),
  newPicks: z.array(z.object({
    title: z.string().min(1).max(120),
    reason: z.string().min(5).max(300),
  })).max(8).default([]),
})

export type VibeResult = z.infer<typeof vibeSchema>

const SYSTEM = `Anime-kereső asszisztens vagy. A felhasználó egy hangulatot/kívánságot ír le,
és megadhat konkrét animéket a saját listájából kontextusnak.
A FŐ EREDMÉNY az ÚJ felfedezés:
- "newPicks": 3-6 anime-cím, ami NINCS a felhasználó listáján és a kérésre passzol.
  TILOS olyan címet adni, ami a "Saját listám" blokkban szerepel.
- "ownPicks": mellé max 3-4 HASONLÓ cím a saját listájáról, referenciának
  ("ilyesmit már ismersz") — az indoklás mondja meg, miben hasonlít a kérésre.
  Csak a megadott animeId-ket használhatod.
Minden indoklás rövid, magyar, az ízlés-tényekre hivatkozik.
Válaszolj KIZÁRÓLAG JSON-nal:
{"newPicks":[{"title":"…","reason":"…"}],"ownPicks":[{"animeId":szám,"reason":"…"}]}`

export type VibeOwnAnime = {
  id: number
  title: string
  genres: string[]
  facts: string[]
  selected: boolean
}

export function buildVibeMessages(
  prompt: string,
  own: VibeOwnAnime[],
  globalFacts: string[],
): ChatMessage[] {
  const selected = own.filter((a) => a.selected)
  const selectedBlock = selected.length
    ? `Kiemelt animék a kéréshez (ezekre mindenképp figyelj):\n${selected.map((a) =>
        `[${a.id}] ${a.title} — ${a.genres.join(', ')}${a.facts.length ? `; tények: ${a.facts.join('; ')}` : ''}`,
      ).join('\n')}\n\n`
    : ''
  const listBlock = own.map((a) => `[${a.id}] ${a.title}`).join('\n')
  const factsBlock = globalFacts.length ? globalFacts.map((f) => `- ${f}`).join('\n') : '- (üres)'
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Kérés: ${prompt}\n\n${selectedBlock}Ízlés-memóriám:\n${factsBlock}\n\nSaját listám:\n${listBlock}`,
    },
  ]
}

export function parseVibe(raw: string): VibeResult {
  return vibeSchema.parse(extractJson(raw))
}
