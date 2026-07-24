import { describe, expect, it } from 'vitest'
import { opinionQueue, type OpinionQueueInput } from './opinion-queue'

const mk = (o: Partial<OpinionQueueInput>): OpinionQueueInput => ({
  id: 1, titleRomaji: 'X', coverUrl: null, status: 'completed', myScore: null,
  createdAt: '2026-01-01T00:00:00Z', hasOpinion: false, extractStatus: null, ...o,
})

describe('opinionQueue', () => {
  it('kiszuri akinek mar van velemenye', () => {
    expect(opinionQueue([mk({ hasOpinion: true, extractStatus: 'done' })])).toEqual([])
  })
  it('failed extract visszakerul a sorba', () => {
    expect(opinionQueue([mk({ hasOpinion: true, extractStatus: 'failed' })])).toHaveLength(1)
  })
  it('planned nem jelenik meg', () => {
    expect(opinionQueue([mk({ status: 'planned' })])).toEqual([])
  })
  it('completed elol, aztan watching, aztan dropped; belul myScore desc', () => {
    const rows = [
      mk({ id: 1, status: 'watching' }),
      mk({ id: 2, status: 'completed', myScore: 7 }),
      mk({ id: 3, status: 'dropped' }),
      mk({ id: 4, status: 'completed', myScore: 9 }),
    ]
    expect(opinionQueue(rows).map((r) => r.id)).toEqual([4, 2, 1, 3])
  })
  it('azonos statusz+pont: frissebb elol', () => {
    const rows = [
      mk({ id: 1, createdAt: '2026-01-01T00:00:00Z' }),
      mk({ id: 2, createdAt: '2026-06-01T00:00:00Z' }),
    ]
    expect(opinionQueue(rows).map((r) => r.id)).toEqual([2, 1])
  })
})
