import { z } from 'zod'
import { glmChat, extractJson, type ChatMessage, type GlmOpts } from './glm'
import type { Locale } from './locale'
import { languageInstruction } from './prompt-locale'

export const factsSchema = z.object({
  facts: z.array(z.object({
    kind: z.enum(['like', 'dislike', 'note']),
    text: z.string().min(3).max(200),
  })).min(1).max(10),
})

export type Fact = z.infer<typeof factsSchema>['facts'][number]

const SYSTEM = `Ízlés-elemző vagy. A felhasználó egy animéről írt személyes véleményéből
kinyered a tömör ízlés-tényeket. Válaszolj KIZÁRÓLAG JSON-nal, ebben a formában:
{"facts":[{"kind":"like|dislike|note","text":"rövid tény"}]}
Szabályok: 3-8 tény; "like" = ami tetszett, "dislike" = ami zavarta, "note" = egyéb
fontos megfigyelés az ízléséről; minden text max 1 rövid mondat.`

// A kinyert tények a felületen is megjelennek (TasteCard, ProfileReveal), ezért
// a felhasználó nyelvén készülnek, és a taste_memory.lang jelöli, melyiken.
export function buildExtractMessages(
  title: string, opinion: string, locale: Locale,
): ChatMessage[] {
  return [
    { role: 'system', content: `${SYSTEM}\n${languageInstruction(locale)}` },
    { role: 'user', content: `Anime: ${title}\n\nVélemény:\n${opinion}` },
  ]
}

export function parseFacts(raw: string): Fact[] {
  return factsSchema.parse(extractJson(raw)).facts
}

export async function extractFacts(
  title: string, opinion: string, locale: Locale, opts: GlmOpts = {},
): Promise<Fact[]> {
  const messages = buildExtractMessages(title, opinion, locale)
  const first = await glmChat(messages, opts)
  try {
    return parseFacts(first)
  } catch {
    const second = await glmChat([
      ...messages,
      { role: 'user', content: 'A válaszod nem volt érvényes JSON. Küldd újra, CSAK a JSON-t.' },
    ], opts)
    return parseFacts(second)
  }
}
