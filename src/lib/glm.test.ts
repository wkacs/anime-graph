import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractJson, glmChat } from './glm'

afterEach(() => vi.unstubAllGlobals())

describe('glmChat', () => {
  it('kikapcsolja a flash reasoning-módot (thinking: disabled), különben a nagy promptok túllépik a 30s timeoutot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await glmChat([{ role: 'user', content: 'hi' }])
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.model).toBe('glm-4.7-flash')
  })

  it('429 után újrapróbál, és a következő sikeres választ adja vissza', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":{"code":"1305"}}', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'masodik' } }] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(glmChat([{ role: 'user', content: 'hi' }])).resolves.toBe('masodik')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON inside a fenced code block with prose around', () => {
    const text = 'Íme a válasz:\n```json\n{"facts":[{"kind":"like","text":"jó zene"}]}\n```\nremélem segít'
    expect(extractJson(text)).toEqual({ facts: [{ kind: 'like', text: 'jó zene' }] })
  })

  it('handles nested braces and braces inside strings', () => {
    const text = 'x {"a":{"b":"}"},"c":2} y'
    expect(extractJson(text)).toEqual({ a: { b: '}' }, c: 2 })
  })

  it('throws when no JSON object present', () => {
    expect(() => extractJson('nincs itt semmi')).toThrow()
  })
})
