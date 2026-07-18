import { describe, it, expect } from 'vitest'
import { parseThemes } from './themes'

const fixture = {
  anime: [
    {
      name: 'Steins;Gate',
      animethemes: [
        {
          type: 'OP',
          sequence: 1,
          slug: 'OP1',
          song: { title: 'Hacking to the Gate', artists: [{ name: 'Kanako Itou' }] },
          animethemeentries: [
            { videos: [{ link: 'https://v.animethemes.moe/SteinsGate-OP1.webm', resolution: 720 }] },
          ],
        },
        {
          type: 'ED',
          sequence: 1,
          slug: 'ED1',
          song: { title: 'Toki Tsukasadoru...', artists: [] },
          animethemeentries: [{ videos: [] }],
        },
      ],
    },
  ],
}

describe('parseThemes', () => {
  it('extracts playable themes with song and artist', () => {
    const out = parseThemes(fixture)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      slug: 'OP1',
      type: 'OP',
      song: 'Hacking to the Gate',
      artist: 'Kanako Itou',
      videoUrl: 'https://v.animethemes.moe/SteinsGate-OP1.webm',
    })
  })

  it('drops themes without a video and tolerates empty payloads', () => {
    expect(parseThemes({ anime: [] })).toEqual([])
    expect(parseThemes({})).toEqual([])
  })
})
