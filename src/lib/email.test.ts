import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  escapeHtml, htmlToText, verifyEmailTemplate, resetEmailTemplate, sendEmail,
} from './email'

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
  it('HTML-be kerulo ertekeket escape-el', () => {
    expect(escapeHtml('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;')
  })
  it('plain-text fallback nem tartalmaz HTML tageket', () => {
    expect(htmlToText('<h1>Hello</h1><p>World &amp; all</p>')).toBe('Hello\nWorld & all')
  })
})

describe('sendEmail', () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.FROM_EMAIL }
  afterEach(() => {
    vi.unstubAllGlobals()
    if (saved.key == null) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = saved.key
    if (saved.from == null) delete process.env.FROM_EMAIL
    else process.env.FROM_EMAIL = saved.from
  })

  it('kulcs nelkul no-op, nem dob', async () => {
    delete process.env.RESEND_API_KEY
    const r = await sendEmail('a@b.c', 's', '<p>x</p>')
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('email_kuldo_nincs_beallitva')
  })

  it('plain textet, idempotenciakulcsot es taget kuld, az email ID-t visszaadja', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.FROM_EMAIL = 'Anime Graph <hello@example.test>'
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 'email_123' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail('user@example.test', 'Subject', '<p>Hello</p>', {
      idempotencyKey: 'verify-123',
      tag: 'email-verification',
    })

    expect(result).toEqual({ sent: true, id: 'email_123' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('verify-123')
    const body = JSON.parse(String(init.body))
    expect(body.text).toBe('Hello')
    expect(body.tags).toEqual([{ name: 'category', value: 'email-verification' }])
  })

  it('nem-2xx Resend valaszt hibakent ad vissza', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.FROM_EMAIL = 'Anime Graph <hello@example.test>'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    const result = await sendEmail('user@example.test', 'Subject', '<p>Hello</p>')
    expect(result.sent).toBe(false)
    expect(result.status).toBe(429)
  })
})
