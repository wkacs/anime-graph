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

// Strukturált ízlés-jel: ez táplálja a lokális rangsorolót. A szabad szöveges
// ténytől külön él, mert az a felületre való, ez pedig a vektorba.
export const signalSchema = z.object({
  feature: z.string().min(2).max(80),
  polarity: z.number(),
  strength: z.number(),
})

export const extractSchema = z.object({
  facts: factsSchema.shape.facts,
  signals: z.array(signalSchema).max(20).default([]),
})

export type Signal = { feature: string; polarity: 1 | -1; strength: number }

const SYSTEM = `Ízlés-elemző vagy. A felhasználó egy animéről írt személyes véleményéből
kinyered a tömör ízlés-tényeket. Válaszolj KIZÁRÓLAG JSON-nal, ebben a formában:
{"facts":[{"kind":"like|dislike|note","text":"rövid tény"}],"signals":[{"feature":"…","polarity":1,"strength":0.8}]}
Szabályok: 3-8 tény; "like" = ami tetszett, "dislike" = ami zavarta, "note" = egyéb
fontos megfigyelés az ízléséről; minden text max 1 rövid mondat.
A "signals" tömbben add meg, MELY konkrét jellemzők tetszettek vagy zavartak. CSAK a
megadott "Választható jellemzők" listából választhatsz kulcsot, mást NE találj ki.
polarity: 1 ha tetszett, -1 ha zavarta. strength: 0 és 1 közötti erősség.
Ha egy jellemző nem derül ki egyértelműen a véleményből, hagyd ki.`

function normalizeSignal(s: { feature: string; polarity: number; strength: number }): Signal {
  return {
    feature: s.feature.toLowerCase(),
    polarity: s.polarity >= 0 ? 1 : -1,
    strength: Math.max(0, Math.min(1, s.strength)),
  }
}

// A kinyert tények a felületen is megjelennek (TasteCard, ProfileReveal), ezért
// a felhasználó nyelvén készülnek, és a taste_memory.lang jelöli, melyiken.
// Az allowedFeatures a VÉLEMÉNY TÁRGYÁNAK saját feature-készlete — így a prompt nem
// hízik meg az AniList ~500 tagjétől, és a jel garantáltan illeszkedik a katalógushoz.
export function buildExtractMessages(
  title: string, opinion: string, locale: Locale, allowedFeatures: string[],
): ChatMessage[] {
  return [
    { role: 'system', content: `${SYSTEM}\n${languageInstruction(locale)}` },
    {
      role: 'user',
      content: `Anime: ${title}\n\nVélemény:\n${opinion}\n\n`
        + `Választható jellemzők:\n${allowedFeatures.join('\n')}`,
    },
  ]
}

export function parseFacts(raw: string): Fact[] {
  return factsSchema.parse(extractJson(raw)).facts
}

export function parseExtract(raw: string): { facts: Fact[]; signals: Signal[] } {
  const parsed = extractSchema.parse(extractJson(raw))
  return { facts: parsed.facts, signals: parsed.signals.map(normalizeSignal) }
}

/** Szókészlet-őr: ami nincs a cím feature-készletében, azt eldobjuk — nem
 *  szennyezheti a vektort olyan kulcs, amit a katalógus sosem ad vissza. */
export function filterSignals(
  signals: { feature: string; polarity: number; strength: number }[],
  allowedFeatures: string[],
): Signal[] {
  const allowed = new Set(allowedFeatures.map((f) => f.toLowerCase()))
  return signals
    .map(normalizeSignal)
    .filter((s) => allowed.has(s.feature) && s.strength > 0)
}

export async function extractAll(
  title: string, opinion: string, locale: Locale,
  allowedFeatures: string[], opts: GlmOpts = {},
): Promise<{ facts: Fact[]; signals: Signal[] }> {
  const messages = buildExtractMessages(title, opinion, locale, allowedFeatures)
  const first = await glmChat(messages, opts)
  try {
    return parseExtract(first)
  } catch {
    const second = await glmChat([
      ...messages,
      { role: 'user', content: 'A válaszod nem volt érvényes JSON. Küldd újra, CSAK a JSON-t.' },
    ], opts)
    return parseExtract(second)
  }
}
