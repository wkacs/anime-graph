export type VibeChip = { id: string; label: string; prompt: string }

export const VIBE_PRESETS: { group: string; chips: VibeChip[] }[] = [
  { group: 'Hangulat', chips: [
    { id: 'mood-happy', label: 'Vidám', prompt: 'vidám, feel-good hangulat' },
    { id: 'mood-dark', label: 'Sötét', prompt: 'sötét, komor hangulat' },
    { id: 'mood-sad', label: 'Megható', prompt: 'megható, érzelmes történet' },
    { id: 'mood-tense', label: 'Feszült', prompt: 'feszült, izgalmas' },
    { id: 'mood-cozy', label: 'Kikapcsoló', prompt: 'könnyed, kikapcsoló' },
  ]},
  { group: 'Műfaj', chips: [
    { id: 'g-action', label: 'Action', prompt: 'akció' },
    { id: 'g-romance', label: 'Romance', prompt: 'romantikus' },
    { id: 'g-comedy', label: 'Comedy', prompt: 'vígjáték' },
    { id: 'g-drama', label: 'Drama', prompt: 'dráma' },
    { id: 'g-fantasy', label: 'Fantasy', prompt: 'fantasy' },
    { id: 'g-scifi', label: 'Sci-Fi', prompt: 'sci-fi' },
    { id: 'g-sol', label: 'Slice of Life', prompt: 'slice of life' },
    { id: 'g-thriller', label: 'Thriller', prompt: 'thriller' },
  ]},
  { group: 'Hossz', chips: [
    { id: 'len-movie', label: 'Film', prompt: 'egyestés film' },
    { id: 'len-short', label: 'Rövid (≤13)', prompt: 'rövid, legfeljebb 13 részes sorozat' },
    { id: 'len-normal', label: 'Normál', prompt: 'normál hosszúságú sorozat' },
    { id: 'len-long', label: 'Hosszú (50+)', prompt: 'hosszú, 50+ részes sorozat' },
  ]},
  { group: 'Korszak', chips: [
    { id: 'era-classic', label: 'Klasszikus', prompt: '2000 előtti klasszikus' },
    { id: 'era-2000s', label: '2000-es évek', prompt: '2000-es évekbeli' },
    { id: 'era-2010s', label: '2010-es évek', prompt: '2010-es évekbeli' },
    { id: 'era-fresh', label: 'Friss (2020+)', prompt: 'friss, 2020 utáni' },
  ]},
  { group: 'Tempó', chips: [
    { id: 'pace-slow', label: 'Lassú-hangulatos', prompt: 'lassú tempójú, hangulatos' },
    { id: 'pace-fast', label: 'Pörgős', prompt: 'pörgős, gyors tempójú' },
  ]},
  { group: 'Helyszín', chips: [
    { id: 'set-school', label: 'Iskola', prompt: 'iskolai környezetben játszódik' },
    { id: 'set-fantasy', label: 'Fantasy-világ', prompt: 'fantasy-világban játszódik' },
    { id: 'set-space', label: 'Űr', prompt: 'űrben / sci-fi világban játszódik' },
    { id: 'set-historical', label: 'Történelmi', prompt: 'történelmi korban játszódik' },
    { id: 'set-city', label: 'Nagyváros', prompt: 'modern nagyvárosban játszódik' },
  ]},
  { group: 'Témák', chips: [
    { id: 'th-revenge', label: 'Bosszú', prompt: 'bosszú-történet' },
    { id: 'th-sport', label: 'Sport', prompt: 'sport-téma' },
    { id: 'th-music', label: 'Zene', prompt: 'zenei téma' },
    { id: 'th-psych', label: 'Pszichológiai', prompt: 'pszichológiai mélységű' },
    { id: 'th-mecha', label: 'Mecha', prompt: 'mecha / óriásrobotok' },
    { id: 'th-isekai', label: 'Isekai', prompt: 'isekai, másik világba kerülés' },
    { id: 'th-timetravel', label: 'Időutazás', prompt: 'időutazás-téma' },
    { id: 'th-martial', label: 'Harcművészet', prompt: 'harcművészet, látványos küzdelmek' },
  ]},
  { group: 'Célközönség', chips: [
    { id: 'demo-shounen', label: 'Shounen', prompt: 'shounen-stílusú' },
    { id: 'demo-seinen', label: 'Seinen', prompt: 'seinen, felnőttesebb hangvétel' },
    { id: 'demo-shoujo', label: 'Shoujo', prompt: 'shoujo-stílusú' },
    { id: 'demo-josei', label: 'Josei', prompt: 'josei, felnőtt női közönségnek' },
  ]},
  { group: 'Forrás', chips: [
    { id: 'src-manga', label: 'Manga-adaptáció', prompt: 'manga-adaptáció' },
    { id: 'src-ln', label: 'Light novel', prompt: 'light novel adaptáció' },
    { id: 'src-original', label: 'Eredeti anime', prompt: 'eredeti (nem adaptáció) anime' },
    { id: 'src-game', label: 'Játék-adaptáció', prompt: 'videojáték-adaptáció' },
  ]},
]

const BY_ID = new Map(VIBE_PRESETS.flatMap((g) => g.chips).map((c) => [c.id, c]))

// kiválasztott chipek prompt-darabjai + custom szöveg → egyetlen kérés-string
export function buildVibePrompt(selectedIds: string[], custom: string): string {
  const parts = selectedIds.map((id) => BY_ID.get(id)?.prompt).filter((p): p is string => !!p)
  const c = custom.trim()
  if (c) parts.push(c)
  return parts.join(', ')
}

// Chip → katalógus-feature. A `Hangulat` és a `Tempó` csoport SZÁNDÉKOSAN hiányzik:
// ezekre az AniList-nek nincs megfelelője, tehát nem pontozhatók lokálisan.
// A konkrét adaptáció-típusok (manga / light novel / játék) szintén kimaradnak:
// a katalógusból csak az derül ki, HOGY adaptáció, az nem, hogy miből.
const CHIP_FEATURES: Record<string, string> = {
  'g-action': 'g:action', 'g-romance': 'g:romance', 'g-comedy': 'g:comedy',
  'g-drama': 'g:drama', 'g-fantasy': 'g:fantasy', 'g-scifi': 'g:sci-fi',
  'g-sol': 'g:slice of life', 'g-thriller': 'g:thriller',

  'len-movie': 'format:movie', 'len-short': 'length:short',
  'len-normal': 'length:standard', 'len-long': 'length:long',

  'era-classic': 'era:1990s', 'era-2000s': 'era:2000s',
  'era-2010s': 'era:2010s', 'era-fresh': 'era:2020s',

  'set-school': 't:school', 'set-fantasy': 't:isekai', 'set-space': 't:space',
  'set-historical': 't:historical', 'set-city': 't:urban fantasy',

  'th-revenge': 't:revenge', 'th-sport': 'g:sports', 'th-music': 't:music',
  'th-psych': 't:psychological', 'th-mecha': 't:mecha', 'th-isekai': 't:isekai',
  'th-timetravel': 't:time manipulation', 'th-martial': 't:martial arts',

  'demo-shounen': 't:shounen', 'demo-seinen': 't:seinen',
  'demo-shoujo': 't:shoujo', 'demo-josei': 't:josei',

  'src-original': 'source:original',
}

/** A leképezhető chipek feature-kulcsai, és amik nem képezhetők le. */
export function chipFeatureKeys(ids: string[]): { keys: string[]; unmapped: string[] } {
  const keys: string[] = []
  const unmapped: string[] = []
  for (const id of ids) {
    const key = CHIP_FEATURES[id]
    if (key) keys.push(key)
    else unmapped.push(id)
  }
  return { keys: [...new Set(keys)], unmapped }
}
