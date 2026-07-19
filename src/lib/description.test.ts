import { describe, it, expect } from 'vitest'
import { stripHtml, clampText } from './description'

describe('stripHtml', () => {
  it('tageket és <br>-t eltávolít, entitásokat dekódol', () => {
    expect(stripHtml('<b>Hi</b><br>ott&amp;itt <i>x</i>')).toBe('Hi ott&itt x')
  })
  it('null-ra üres string', () => {
    expect(stripHtml(null)).toBe('')
  })
})

describe('clampText', () => {
  it('rövid szöveget nem bánt', () => {
    expect(clampText('rövid', 180)).toBe('rövid')
  })
  it('szóhatáron vág és …-t tesz', () => {
    const out = clampText('a'.repeat(100) + ' vége hosszú szöveg', 105)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(106)
  })
})
