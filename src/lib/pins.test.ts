import { describe, expect, it } from 'vitest'
import { MAX_PINS, PinError, validatePins } from './pins'

describe('validatePins', () => {
  const allowed = new Set([1, 2, 3, 4])
  it('atengedi az ervenyes listat es dedupol', () => {
    expect(validatePins([1, 2, 2], allowed)).toEqual([1, 2])
  })
  it('max 3', () => {
    expect(() => validatePins([1, 2, 3, 4], allowed)).toThrow(PinError)
    expect(MAX_PINS).toBe(3)
  })
  it('nem sajat id -> hiba', () => {
    expect(() => validatePins([99], allowed)).toThrow(PinError)
  })
  it('nem egesz -> hiba', () => {
    expect(() => validatePins(['x'], allowed)).toThrow(PinError)
  })
  it('nem tomb -> hiba', () => {
    expect(() => validatePins('1,2', allowed)).toThrow(PinError)
  })
  it('ures/undefined -> ures lista', () => {
    expect(validatePins(undefined, allowed)).toEqual([])
    expect(validatePins(null, allowed)).toEqual([])
    expect(validatePins([], allowed)).toEqual([])
  })
})
