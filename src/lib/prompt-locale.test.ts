import { describe, it, expect } from 'vitest'
import { languageInstruction } from './prompt-locale'

describe('languageInstruction', () => {
  it('magyar kimenetet ker hu-ra', () => {
    expect(languageInstruction('hu')).toContain('magyarul')
  })
  it('angol kimenetet ker en-re', () => {
    expect(languageInstruction('en')).toContain('English')
  })
  it('a ket utasitas kulonbozik', () => {
    expect(languageInstruction('hu')).not.toBe(languageInstruction('en'))
  })
})
