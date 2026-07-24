import { describe, expect, it } from 'vitest'
import { prioritizeStaff, STAFF_LIMIT } from './staff-cache'
import type { StaffEntry } from './anilist'

const mk = (staffId: number, role: string): StaffEntry =>
  ({ staffId, name: `S${staffId}`, image: null, role })

describe('prioritizeStaff', () => {
  it('Director elol, aztan a tobbi prioritas-sorrendben', () => {
    const entries = [mk(1, 'Music'), mk(2, 'Director'), mk(3, 'Original Creator')]
    expect(prioritizeStaff(entries).map((e) => e.staffId)).toEqual([2, 3, 1])
  })
  it('role-prefix is szamit (pl. "Character Design (assistance)")', () => {
    const entries = [mk(1, 'Key Animation'), mk(2, 'Character Design (assistance)')]
    expect(prioritizeStaff(entries).map((e) => e.staffId)).toEqual([2, 1])
  })
  it('dedupol staffId-ra', () => {
    const entries = [mk(1, 'Director'), mk(1, 'Storyboard')]
    expect(prioritizeStaff(entries)).toHaveLength(1)
  })
  it('max STAFF_LIMIT elem', () => {
    const entries = Array.from({ length: 10 }, (_, i) => mk(i + 1, 'Key Animation'))
    expect(prioritizeStaff(entries)).toHaveLength(STAFF_LIMIT)
    expect(STAFF_LIMIT).toBe(6)
  })
})
