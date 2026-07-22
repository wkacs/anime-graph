import { db } from '@/db/client'
import { aiUsageLog } from '@/db/schema'
import { estimateCost } from './ai-cost'

const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const MODEL = 'glm-4.7-flash'

export type ChatMessage = { role: 'system' | 'user'; content: string }
export type GlmOpts = { retries?: number; userId?: number; endpoint?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// minden sikeres AI-hívás egy ai_usage_log sort ír (WS2 költség-visszamérés).
// best-effort: userId/endpoint nélkül nem logol, és a beszúrás hibája sose bukik a fő hívásra.
async function logUsage(model: string, usage: unknown, opts: GlmOpts, contentLen: number) {
  if (opts.userId == null || !opts.endpoint) return
  const u = (usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number }
  // ha az API nem ad usage-t, becslés ~4 char/token, hogy sose 0 legyen ha volt válasz
  const prompt = u.prompt_tokens ?? 0
  const completion = u.completion_tokens ?? Math.ceil(contentLen / 4)
  try {
    await db.insert(aiUsageLog).values({
      userId: opts.userId, endpoint: opts.endpoint, model,
      promptTokens: prompt, completionTokens: completion,
      estCostUsd: estimateCost(model, prompt, completion),
    })
  } catch (e) {
    console.error('ai_usage_log insert failed:', e)
  }
}

export async function glmChat(
  messages: ChatMessage[],
  opts: GlmOpts = {},
): Promise<string> {
  const { retries = 3 } = opts
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1))
    try {
      const res = await fetch(GLM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GLM_API_KEY}`,
        },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.4 }),
        // a hanging upstream must not block the route (Vercel cap is 60s anyway)
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`GLM HTTP ${res.status}`)
        continue
      }
      if (!res.ok) throw new Error(`GLM HTTP ${res.status}: ${await res.text()}`)
      const json = await res.json()
      const content = json?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content) throw new Error('GLM: üres válasz')
      await logUsage(MODEL, json?.usage, opts, content.length)
      return content
    } catch (e) {
      lastError = e
      const name = e instanceof Error ? e.name : ''
      if (e instanceof TypeError || name === 'TimeoutError' || name === 'AbortError') continue // network/timeout → retry
      throw e
    }
  }
  // GLM exhausted → optional OpenRouter fallback keeps the AI features alive
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await openRouterChat(messages, opts)
    } catch {
      // fall through to the original error
    }
  }
  const msg = String(lastError instanceof Error ? lastError.message : lastError)
  if (msg.includes('429')) {
    throw new Error('Az AI épp a napi limitjén pihen — próbáld újra 1-2 perc múlva')
  }
  throw lastError instanceof Error ? lastError : new Error('GLM: minden próbálkozás elbukott')
}

async function openRouterChat(messages: ChatMessage[], opts: GlmOpts = {}): Promise<string> {
  const orModel = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324:free'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: orModel,
      messages,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content) throw new Error('OpenRouter: üres válasz')
  await logUsage(orModel, json?.usage, opts, content.length)
  return content
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('Nincs JSON a válaszban')
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, i + 1))
    }
  }
  throw new Error('Lezáratlan JSON a válaszban')
}
