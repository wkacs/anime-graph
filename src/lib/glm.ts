const GLM_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const MODEL = 'glm-4.7-flash'

export type ChatMessage = { role: 'system' | 'user'; content: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function glmChat(
  messages: ChatMessage[],
  { retries = 3 }: { retries?: number } = {},
): Promise<string> {
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
      return await openRouterChat(messages)
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

async function openRouterChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-chat-v3-0324:free',
      messages,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content) throw new Error('OpenRouter: üres válasz')
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
