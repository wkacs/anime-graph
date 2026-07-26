import { describe, it, expect } from 'vitest'
import { aiCacheKind } from './ai-cache-key'

describe('aiCacheKind', () => {
  it('a locale bekerul a kulcsba', () => {
    expect(aiCacheKind('recommend', 'hu')).toBe('recommend:hu')
    expect(aiCacheKind('recommend', 'en')).toBe('recommend:en')
  })
  it('ket nyelv kulcsa kulonbozik', () => {
    expect(aiCacheKind('seasonal-ai:2026-SUMMER', 'hu'))
      .not.toBe(aiCacheKind('seasonal-ai:2026-SUMMER', 'en'))
  })
  it('a regi, locale nelkuli kulcs sosem egyezik', () => {
    expect(aiCacheKind('digest', 'en')).not.toBe('digest')
  })
})
