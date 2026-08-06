import { describe, it, expect } from 'vitest'
import { parseDismissed, addDismissed, MAX_DISMISSED } from './ghost-dismiss'

describe('parseDismissed', () => {
  it('szamokat ad vissza', () => {
    expect(parseDismissed([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('barmilyen mas alakra ures — a tarolt jsonb-ben nem bizunk', () => {
    expect(parseDismissed(null)).toEqual([])
    expect(parseDismissed('nope')).toEqual([])
    expect(parseDismissed({ a: 1 })).toEqual([])
  })

  it('a szemetet kiszurja a tombbol is', () => {
    expect(parseDismissed([1, 'x', null, 2.5, -3, 0, 4])).toEqual([1, 4])
  })
})

describe('addDismissed', () => {
  it('az uj elem elore kerul', () => {
    expect(addDismissed([2, 3], 1)).toEqual([1, 2, 3])
  })

  it('nem duplaz: az ismetelt elvetes felhozza a lista elejere', () => {
    expect(addDismissed([2, 3, 1], 1)).toEqual([1, 2, 3])
  })

  it('ures/ervenytelen elozmenyre is mukodik', () => {
    expect(addDismissed(undefined, 7)).toEqual([7])
    expect(addDismissed('szemet', 7)).toEqual([7])
  })

  it('nyirott: a lista nem no korlatlanul', () => {
    const long = Array.from({ length: MAX_DISMISSED + 50 }, (_, i) => i + 1)
    const next = addDismissed(long, 9999)
    expect(next).toHaveLength(MAX_DISMISSED)
    expect(next[0]).toBe(9999)
  })
})
