import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'

export type NlItem = {
  id: number
  title: string
  genres: string[]
  year: number | null
  myScore: number | null
  status: string
  mediaType: string
  opinion: string | null
}

const SYSTEM = `A felhasználó SAJÁT anime/manga-listájában keresel. A kérdésére a listából
válaszolsz: visszaadod a passzoló tételek id-jait és egy rövid magyar választ.
Ha semmi nem passzol, üres matchIds és ezt megmondó answer.
Válaszolj KIZÁRÓLAG JSON-nal: {"matchIds":[szám],"answer":"rövid magyar válasz"}`

export function buildNlMessages(items: NlItem[], query: string): ChatMessage[] {
  const lines = items.map((i) =>
    `[${i.id}] ${i.title} (${i.mediaType === 'MANGA' ? 'manga' : 'anime'}, ${i.year ?? '?'}) — ${i.genres.join('/')}; státusz: ${i.status}; pont: ${i.myScore ?? '-'}${i.opinion ? `; vélemény: ${i.opinion}` : ''}`,
  ).join('\n')
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `A listám:\n${lines}\n\nKérdés: ${query}` },
  ]
}

const nlSchema = z.object({
  matchIds: z.array(z.number().int()).max(50),
  answer: z.string().min(1).max(600),
})

export function parseNlResult(raw: string, validIds: Set<number>): { matchIds: number[]; answer: string } {
  const parsed = nlSchema.parse(extractJson(raw))
  return { matchIds: parsed.matchIds.filter((id) => validIds.has(id)), answer: parsed.answer }
}
