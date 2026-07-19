export type FeedItem = {
  kind: 'added' | 'opinion' | 'episodes' | 'favchar'
  userId: number
  username: string
  animeId: number | null
  anilistId: number | null
  title: string
  detail: string | null
  count: number
  mediaType: string
  status: string | null
  at: string
}

type Common = { userId: number; username: string; animeId: number; anilistId: number; title: string; mediaType: string; at: string }

export type FeedInput = {
  added: (Common & { status: string })[]
  opinions: (Common & { text: string })[]
  episodes: (Common & { episode: number })[]
  favChars: (Common & { charName: string })[]
}

const excerpt = (t: string) => (t.length > 120 ? `${t.slice(0, 120)}…` : t)

export function buildFeed(input: FeedInput, excludeUserId: number, limit = 30): FeedItem[] {
  const items: FeedItem[] = []
  for (const a of input.added) {
    items.push({ kind: 'added', userId: a.userId, username: a.username, animeId: a.animeId, anilistId: a.anilistId, title: a.title, detail: null, count: 1, mediaType: a.mediaType, status: a.status, at: a.at })
  }
  for (const o of input.opinions) {
    items.push({ kind: 'opinion', userId: o.userId, username: o.username, animeId: o.animeId, anilistId: o.anilistId, title: o.title, detail: excerpt(o.text), count: 1, mediaType: o.mediaType, status: null, at: o.at })
  }
  // epizódok: (user, anime, nap) szerint összevonva, a nap utolsó epizódja a detail
  const byDay = new Map<string, { rows: (Common & { episode: number })[]; latest: string }>()
  for (const e of input.episodes) {
    const key = `${e.userId}|${e.animeId}|${e.at.slice(0, 10)}`
    const g = byDay.get(key) ?? { rows: [], latest: e.at }
    g.rows.push(e)
    if (e.at > g.latest) g.latest = e.at
    byDay.set(key, g)
  }
  for (const g of byDay.values()) {
    const last = [...g.rows].sort((a, b) => b.episode - a.episode)[0]
    items.push({ kind: 'episodes', userId: last.userId, username: last.username, animeId: last.animeId, anilistId: last.anilistId, title: last.title, detail: `EP ${last.episode}`, count: g.rows.length, mediaType: last.mediaType, status: null, at: g.latest })
  }
  for (const f of input.favChars) {
    items.push({ kind: 'favchar', userId: f.userId, username: f.username, animeId: f.animeId, anilistId: f.anilistId, title: f.title, detail: f.charName, count: 1, mediaType: f.mediaType, status: null, at: f.at })
  }
  return items
    .filter((i) => i.userId !== excludeUserId)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit)
}
