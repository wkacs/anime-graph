import { describe, it, expect } from 'vitest'
import { mapAnilistStatus, mapMalStatus, parseMalXml } from './import'

describe('mapAnilistStatus', () => {
  it('maps AniList list statuses to internal ones', () => {
    expect(mapAnilistStatus('CURRENT')).toBe('watching')
    expect(mapAnilistStatus('REPEATING')).toBe('watching')
    expect(mapAnilistStatus('COMPLETED')).toBe('completed')
    expect(mapAnilistStatus('PLANNING')).toBe('planned')
    expect(mapAnilistStatus('PAUSED')).toBe('planned')
    expect(mapAnilistStatus('DROPPED')).toBe('dropped')
    expect(mapAnilistStatus('whatever')).toBe('planned')
  })
})

describe('mapMalStatus', () => {
  it('maps MAL export statuses', () => {
    expect(mapMalStatus('Watching')).toBe('watching')
    expect(mapMalStatus('Completed')).toBe('completed')
    expect(mapMalStatus('Plan to Watch')).toBe('planned')
    expect(mapMalStatus('On-Hold')).toBe('planned')
    expect(mapMalStatus('Dropped')).toBe('dropped')
  })
})

describe('parseMalXml', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_name>tester</user_name></myinfo>
  <anime>
    <series_animedb_id>9253</series_animedb_id>
    <series_title><![CDATA[Steins;Gate]]></series_title>
    <my_watched_episodes>24</my_watched_episodes>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
    <my_finish_date>2020-05-01</my_finish_date>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <my_watched_episodes>0</my_watched_episodes>
    <my_score>0</my_score>
    <my_status><![CDATA[Plan to Watch]]></my_status>
    <my_finish_date>0000-00-00</my_finish_date>
  </anime>
</myanimelist>`

  it('parses entries with score, status, progress and finish date', () => {
    const entries = parseMalXml(xml)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      malId: 9253,
      status: 'completed',
      score: 9,
      progress: 24,
      finishedAt: '2020-05-01',
    })
  })

  it('treats score 0 as null and 0000-00-00 as no date', () => {
    const e = parseMalXml(xml)[1]
    expect(e.score).toBeNull()
    expect(e.finishedAt).toBeNull()
    expect(e.status).toBe('planned')
  })

  it('returns empty array for XML without anime blocks', () => {
    expect(parseMalXml('<myanimelist></myanimelist>')).toEqual([])
  })
})
