import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyEmailTemplate, resetEmailTemplate, sendEmail } from './email'

describe('sablonok', () => {
  beforeEach(() => { process.env.APP_URL = 'https://example.test' })
  afterEach(() => { delete process.env.APP_URL })

  it('verify-link a token-nel es az APP_URL-lel epul', () => {
    expect(verifyEmailTemplate('TOK123', 'en').html)
      .toContain('https://example.test/api/auth/verify?token=TOK123')
  })
  it('reset-link a login-oldal reset-agara mutat', () => {
    expect(resetEmailTemplate('TOK456', 'en').html)
      .toContain('https://example.test/login?reset=TOK456')
  })
  it('a targy koveti a locale-t', () => {
    expect(verifyEmailTemplate('t', 'hu').subject).not.toBe(verifyEmailTemplate('t', 'en').subject)
    expect(resetEmailTemplate('t', 'hu').subject).not.toBe(resetEmailTemplate('t', 'en').subject)
  })
})

describe('sendEmail', () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.FROM_EMAIL }
  afterEach(() => {
    if (saved.key == null) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = saved.key
    if (saved.from == null) delete process.env.FROM_EMAIL
    else process.env.FROM_EMAIL = saved.from
  })

  it('kulcs nelkul no-op, nem dob', async () => {
    delete process.env.RESEND_API_KEY
    const r = await sendEmail('a@b.c', 's', '<p>x</p>')
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('RESEND_API_KEY nincs beallitva')
  })
})
