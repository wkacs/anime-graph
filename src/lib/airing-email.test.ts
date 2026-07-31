import { describe, expect, it } from 'vitest'
import { buildDailyAiringEmail } from './airing-email'

describe('daily airing email', () => {
  it('escape-eli a kulso cimet es plain-text reszt is epit', () => {
    const now = new Date('2026-07-31T08:00:00Z')
    const message = buildDailyAiringEmail(
      [{ userId: 1, anilistId: 7, titleRomaji: '<img src=x onerror=alert(1)>' }],
      [{ anilistId: 7, airingAt: Math.floor(now.getTime() / 1000) + 3600, nextEpisode: 3 }],
      now,
    )
    expect(message?.html).toContain('&lt;img')
    expect(message?.html).not.toContain('<img src=x')
    expect(message?.text).toContain('<img src=x')
    expect(message?.idempotencyKey).toBe('airing-digest-2026-07-31')
  })

  it('ures, ha nincs az owner listajan ma erkezo resz', () => {
    const now = new Date('2026-07-31T08:00:00Z')
    expect(buildDailyAiringEmail([], [], now)).toBeNull()
  })
})
