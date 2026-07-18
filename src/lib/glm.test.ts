import { describe, it, expect } from 'vitest'
import { extractJson } from './glm'

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
