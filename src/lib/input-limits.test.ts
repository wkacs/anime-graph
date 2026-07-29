import { describe, expect, it } from 'vitest'
import { exceedsTextLimit, isBoundedStringList } from './input-limits'

describe('input limits', () => {
  it('rejects text only above the configured cap', () => {
    expect(exceedsTextLimit('1234', 4)).toBe(false)
    expect(exceedsTextLimit('12345', 4)).toBe(true)
  })

  it('validates both the array and each item', () => {
    expect(isBoundedStringList(['one', 'two'], 2, 3)).toBe(true)
    expect(isBoundedStringList(['one', 'four'], 2, 3)).toBe(false)
    expect(isBoundedStringList(['one', 'two', 'tri'], 2, 3)).toBe(false)
    expect(isBoundedStringList('one', 2, 3)).toBe(false)
  })
})
