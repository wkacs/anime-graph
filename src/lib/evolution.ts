import { z } from 'zod'
import { extractJson, type ChatMessage } from './glm'
import type { Locale } from './locale'
import { languageInstruction } from './prompt-locale'

export type MonthPoint = { month: string; count: number; avgScore: number | null }

export function monthlyEvolution(
  rows: { watchedAt: string | null; createdAt: string; myScore: number | null }[],
): MonthPoint[] {
  const byMonth = new Map<string, { count: number; scores: number[] }>()
  for (const r of rows) {
    const month = (r.watchedAt ?? r.createdAt).slice(0, 7)
    const g = byMonth.get(month) ?? { count: 0, scores: [] }
    g.count++
    if (r.myScore != null) g.scores.push(r.myScore)
    byMonth.set(month, g)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, g]) => ({
      month, count: g.count,
      avgScore: g.scores.length ? Math.round((g.scores.reduce((s, x) => s + x, 0) / g.scores.length) * 10) / 10 : null,
    }))
}

export const erasSchema = z.object({
  eras: z.array(z.object({
    label: z.string().min(2).max(60),
    summary: z.string().min(10).max(400),
    from: z.string(),
    to: z.string(),
  })).min(2).max(5),
})

export type TasteEra = z.infer<typeof erasSchema>['eras'][number]

const SYSTEM = `A felhasználó időrendbe rakott ízlés-tényeiből 2-5 "ízlés-korszakot" azonosítasz.
Minden korszaknak: rövid címke, 2-3 mondatos összefoglaló, from/to (ÉÉÉÉ-HH).
Válaszolj KIZÁRÓLAG JSON-nal: {"eras":[{"label":"…","summary":"…","from":"ÉÉÉÉ-HH","to":"ÉÉÉÉ-HH"}]}`

export function buildErasMessages(
  facts: { text: string; at: string }[], locale: Locale,
): ChatMessage[] {
  const lines = facts.map((f) => `${f.at.slice(0, 7)}: ${f.text}`).join('\n')
  return [
    { role: 'system', content: `${SYSTEM}
${languageInstruction(locale)}` },
    { role: 'user', content: `Ízlés-tényeim időrendben:\n${lines}` },
  ]
}

export function parseEras(raw: string): TasteEra[] {
  return erasSchema.parse(extractJson(raw)).eras
}
