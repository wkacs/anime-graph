import { describe, expect, it } from 'vitest'
import { parseSentryDsn, sanitizeReport } from './monitor'

describe('parseSentryDsn', () => {
  it('a DSN-ből store-URL és auth-fejléc lesz', () => {
    const t = parseSentryDsn('https://abc123@o4507.ingest.de.sentry.io/4508111')
    expect(t?.url).toBe('https://o4507.ingest.de.sentry.io/api/4508111/store/')
    expect(t?.authHeader).toContain('sentry_key=abc123')
  })

  it('hibás DSN-re null', () => {
    expect(parseSentryDsn('nem-url')).toBeNull()
    expect(parseSentryDsn('https://host.io/nem-szam')).toBeNull()
    expect(parseSentryDsn('https://host.io/123')).toBeNull() // nincs kulcs
  })
})

describe('sanitizeReport', () => {
  it('üzenet nélkül nincs riport', () => {
    expect(sanitizeReport({})).toBeNull()
    expect(sanitizeReport({ message: '   ' })).toBeNull()
    expect(sanitizeReport(null)).toBeNull()
    expect(sanitizeReport('szöveg')).toBeNull()
  })

  it('a mezők típus-ellenőrzöttek és méret-korlátosak', () => {
    const r = sanitizeReport({ message: 'x'.repeat(600), stack: 'y'.repeat(5000), url: 'z'.repeat(400), extra: 1 })
    expect(r?.message).toHaveLength(500)
    expect(r?.stack).toHaveLength(4000)
    expect(r?.url).toHaveLength(300)
    expect(r && 'extra' in r).toBe(false)
  })

  it('nem-string stack/url kimarad', () => {
    const r = sanitizeReport({ message: 'hiba', stack: 42, url: {} })
    expect(r).toEqual({ message: 'hiba', stack: undefined, url: undefined })
  })
})
