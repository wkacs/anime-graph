import { describe, expect, it } from 'vitest'
import { deliveryDisposition, pushDeliveryKey } from './push-delivery'

describe('push delivery dedup', () => {
  it('stabil, de endpointet nem tartalmazo cache-kulcsot kepez', () => {
    const endpoint = 'https://push.example/subscription/secret'
    const first = pushDeliveryKey('airing:1:2', endpoint)
    expect(first).toBe(pushDeliveryKey('airing:1:2', endpoint))
    expect(first).not.toContain(endpoint)
    expect(first).not.toBe(pushDeliveryKey('airing:1:3', endpoint))
  })

  it('sent allapotot deduplikal, friss pendinget nem lop el, regi pendinget ujraprobal', () => {
    const now = new Date('2026-07-31T10:00:00Z')
    expect(deliveryDisposition({ state: 'sent' }, new Date('2020-01-01'), now)).toBe('sent')
    expect(deliveryDisposition({ state: 'pending' }, new Date('2026-07-31T09:50:00Z'), now)).toBe('pending')
    expect(deliveryDisposition({ state: 'pending' }, new Date('2026-07-31T09:30:00Z'), now)).toBe('retry')
  })
})

