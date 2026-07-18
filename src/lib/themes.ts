export type AnimeTheme = {
  slug: string
  type: string // OP | ED
  song: string | null
  artist: string | null
  videoUrl: string
}

type ThemesPayload = {
  anime?: {
    animethemes?: {
      type?: string
      slug?: string
      song?: { title?: string; artists?: { name?: string }[] } | null
      animethemeentries?: { videos?: { link?: string }[] }[]
    }[]
  }[]
}

// animethemes.moe response → flat, playable list (video-less themes dropped)
export function parseThemes(payload: ThemesPayload): AnimeTheme[] {
  const themes = payload.anime?.[0]?.animethemes ?? []
  const out: AnimeTheme[] = []
  for (const t of themes) {
    const videoUrl = t.animethemeentries?.[0]?.videos?.[0]?.link
    if (!videoUrl || !t.slug) continue
    out.push({
      slug: t.slug,
      type: t.type ?? (t.slug.startsWith('ED') ? 'ED' : 'OP'),
      song: t.song?.title ?? null,
      artist: t.song?.artists?.[0]?.name ?? null,
      videoUrl,
    })
  }
  return out
}

export async function fetchThemes(anilistId: number): Promise<AnimeTheme[]> {
  const url =
    'https://api.animethemes.moe/anime?' +
    new URLSearchParams({
      'filter[has]': 'resources',
      'filter[site]': 'AniList',
      'filter[external_id]': String(anilistId),
      include: 'animethemes.animethemeentries.videos,animethemes.song.artists',
    }).toString()
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`animethemes HTTP ${res.status}`)
  return parseThemes(await res.json())
}
