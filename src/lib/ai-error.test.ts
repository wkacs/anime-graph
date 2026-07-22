import { describe, it, expect } from 'vitest'
import { aiUserErrorMessage } from './ai-error'

describe('aiUserErrorMessage', () => {
  it('napi limitnél a limit-üzenetet adja vissza', () => {
    expect(aiUserErrorMessage(new Error('Elérted a napi AI-keretet (5 hívás) — holnap folytathatod')))
      .toContain('napi AI-keretet')
  })
  it('minden más hibánál általános üzenet, NEM a nyers hiba', () => {
    const msg = aiUserErrorMessage(new Error('ECONNREFUSED 10.0.0.1:443 stacktrace...'))
    expect(msg).not.toContain('ECONNREFUSED')
    expect(msg).toContain('nem elérhető')
  })
})
