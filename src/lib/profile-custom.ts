// A profil-személyreszabás egyetlen settings-kulcsban él (`profileCustom`),
// így nincs sémamigráció. Minden mentés ezen a sanitizeren megy át — a
// kliens bármit küldhet, ide csak validált érték jut be.

export type ProfileSections = {
  stats: boolean
  top: boolean
  activity: boolean
}

export type ProfileCustom = {
  displayName: string | null
  // AniList CDN-kép (saját borító vagy kedvenc karakter) — nincs feltöltés/tároló.
  avatarUrl: string | null
  // saját cím id-ja, aminek a bannere a profil-fejléc — ownership a settings API-ban
  bannerTitleId: number | null
  accent: string | null
  favGenres: string[]
  sections: ProfileSections
}

// Charcoal-on olvasható, világos pasztell akcentek. Zöld szándékosan nincs:
// a zöld ebben a designban adat-szemantika (státusz: nézem), nem UI-akcent.
export const PROFILE_ACCENTS = [
  '#7dd3fc', // ég
  '#a5b4fc', // indigó
  '#c4b5fd', // ibolya
  '#f0abfc', // fukszia
  '#fda4af', // rózsa
  '#fca5a5', // korall
  '#fcd34d', // borostyán
  '#fdba74', // narancs
] as const

export const DEFAULT_SECTIONS: ProfileSections = { stats: true, top: true, activity: true }

export const EMPTY_PROFILE_CUSTOM: ProfileCustom = {
  displayName: null,
  avatarUrl: null,
  bannerTitleId: null,
  accent: null,
  favGenres: [],
  sections: DEFAULT_SECTIONS,
}

const MAX_DISPLAY_NAME = 40
const MAX_GENRES = 5
const MAX_GENRE_LEN = 24

// Kontroll-karakterek (C0 + DEL) unicode-escape-pel: nyers bájt nem kerülhet a forrásba.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

// Kizárólag az AniList CDN-je: a profilkép publikus oldalon renderelődik,
// tetszőleges URL-t (tracking-pixel, http, javascript:) nem engedünk be.
export function isAllowedImageUrl(url: string): boolean {
  return url.startsWith('https://s4.anilist.co/') && !url.includes('..')
}

function cleanDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_DISPLAY_NAME)
}

function cleanGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const g of value) {
    if (typeof g !== 'string') continue
    const cleaned = g.replace(CONTROL_CHARS, '').trim()
    if (!cleaned || cleaned.length > MAX_GENRE_LEN) continue
    if (out.includes(cleaned)) continue
    out.push(cleaned)
    if (out.length >= MAX_GENRES) break
  }
  return out
}

function cleanSections(value: unknown): ProfileSections {
  const v = (value ?? {}) as Record<string, unknown>
  const bool = (x: unknown, fallback: boolean) => (typeof x === 'boolean' ? x : fallback)
  return {
    stats: bool(v.stats, DEFAULT_SECTIONS.stats),
    top: bool(v.top, DEFAULT_SECTIONS.top),
    activity: bool(v.activity, DEFAULT_SECTIONS.activity),
  }
}

export function sanitizeProfileCustom(input: unknown): ProfileCustom {
  const v = (input ?? {}) as Record<string, unknown>
  const avatarUrl = typeof v.avatarUrl === 'string' && isAllowedImageUrl(v.avatarUrl)
    ? v.avatarUrl.slice(0, 300)
    : null
  const bannerTitleId = typeof v.bannerTitleId === 'number'
    && Number.isInteger(v.bannerTitleId) && v.bannerTitleId > 0
    ? v.bannerTitleId
    : null
  const accent = typeof v.accent === 'string'
    && (PROFILE_ACCENTS as readonly string[]).includes(v.accent)
    ? v.accent
    : null
  return {
    displayName: cleanDisplayName(v.displayName),
    avatarUrl,
    bannerTitleId,
    accent,
    favGenres: cleanGenres(v.favGenres),
    sections: cleanSections(v.sections),
  }
}
