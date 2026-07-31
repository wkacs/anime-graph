import { afterEach, describe, expect, it } from 'vitest'
import { authorizeUrl } from './sync-oauth'

const original = {
  appUrl: process.env.APP_URL,
  anilistClientId: process.env.ANILIST_CLIENT_ID,
}

afterEach(() => {
  if (original.appUrl == null) delete process.env.APP_URL
  else process.env.APP_URL = original.appUrl
  if (original.anilistClientId == null) delete process.env.ANILIST_CLIENT_ID
  else process.env.ANILIST_CLIENT_ID = original.anilistClientId
})

describe('AniList OAuth authorize URL', () => {
  it('state-et es stabil production redirectet kuld', () => {
    process.env.APP_URL = 'https://anime-graph.example/'
    process.env.ANILIST_CLIENT_ID = '1234'
    const raw = authorizeUrl('anilist', 'http://localhost:3000', 'csrf-state', 'unused')
    const url = new URL(raw!)
    expect(url.searchParams.get('state')).toBe('csrf-state')
    expect(url.searchParams.get('redirect_uri'))
      .toBe('https://anime-graph.example/api/sync/anilist/callback')
  })
})
