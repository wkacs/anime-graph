import { describe, it, expect } from 'vitest'
import { buildLocalCandidates } from './local-candidates'

const cat = (anilistId: number, genres: string[], communityScore: number | null, avgScore: number | null, relations: number[] = []) => ({
  anilistId, titleRomaji: `T${anilistId}`, coverUrl: null, genres,
  communityScore, avgScore,
  relations: relations.map((id) => ({ type: 'RELATED', anilistId: id, title: '' })),
})

describe('buildLocalCandidates', () => {
  const catalog = [
    cat(10, ['Action'], 8.5, 80),
    cat(11, ['Action', 'Drama'], 7.0, 75),
    cat(12, ['Romance'], 9.0, 90),
    cat(13, ['Action'], null, 60),
  ]
  it('a kedvencek relations-ét és azonos-genre címeit hozza, owned kizárva', () => {
    const favorites = [{ anilistId: 99, genres: ['Action'], relations: [11] }]
    const out = buildLocalCandidates(favorites, catalog, new Set([10]))
    const ids = out.map((c) => c.anilistId)
    expect(ids).toContain(11)   // relation ÉS azonos genre
    expect(ids).toContain(13)   // azonos genre
    expect(ids).not.toContain(10) // owned
    expect(ids).not.toContain(99) // maga a kedvenc (nincs is a katalógusban itt)
  })
  it('RecCandidate alakot ad (anilistId,title,coverUrl,genres,avgScore)', () => {
    const out = buildLocalCandidates([{ anilistId: 1, genres: ['Romance'], relations: [] }], catalog, new Set())
    expect(out[0]).toHaveProperty('anilistId')
    expect(out[0]).toHaveProperty('genres')
    expect(out[0]).toHaveProperty('avgScore')
  })
  it('a batch-cache-elt recIds is jelölt (relation-szintű súllyal)', () => {
    const only = [
      { anilistId: 20, titleRomaji: 'T20', coverUrl: null, genres: ['Mystery'], communityScore: null, avgScore: 70, relations: [] },
    ]
    const out = buildLocalCandidates([{ anilistId: 1, genres: [], relations: [] }], only, new Set(), 200, new Set([20]))
    expect(out.map((c) => c.anilistId)).toContain(20)
  })
})
