// A chip FELIRATA a szotarban ul (`vibeChips` namespace, kulcs = chip-id); itt
// csak az azonosito es a modellnek szant prompt-darab van.
//
// A `prompt` szandekosan magyar marad: ez a modell BEMENETE, nem felulet-szoveg,
// es a valasz nyelvet kulon a `languageInstruction` allitja (prompt-locale.ts).
export type VibeChip = { id: string; prompt: string }

export const VIBE_PRESETS: { groupId: string; chips: VibeChip[] }[] = [
  { groupId: 'mood', chips: [
    { id: 'mood-happy', prompt: 'vidám, feel-good hangulat' },
    { id: 'mood-dark', prompt: 'sötét, komor hangulat' },
    { id: 'mood-sad', prompt: 'megható, érzelmes történet' },
    { id: 'mood-tense', prompt: 'feszült, izgalmas' },
    { id: 'mood-cozy', prompt: 'könnyed, kikapcsoló' },
  ]},
  { groupId: 'genre', chips: [
    { id: 'g-action', prompt: 'akció' },
    { id: 'g-romance', prompt: 'romantikus' },
    { id: 'g-comedy', prompt: 'vígjáték' },
    { id: 'g-drama', prompt: 'dráma' },
    { id: 'g-fantasy', prompt: 'fantasy' },
    { id: 'g-scifi', prompt: 'sci-fi' },
    { id: 'g-sol', prompt: 'slice of life' },
    { id: 'g-thriller', prompt: 'thriller' },
  ]},
  { groupId: 'length', chips: [
    { id: 'len-movie', prompt: 'egyestés film' },
    { id: 'len-short', prompt: 'rövid, legfeljebb 13 részes sorozat' },
    { id: 'len-normal', prompt: 'normál hosszúságú sorozat' },
    { id: 'len-long', prompt: 'hosszú, 50+ részes sorozat' },
  ]},
  { groupId: 'era', chips: [
    { id: 'era-classic', prompt: '2000 előtti klasszikus' },
    { id: 'era-2000s', prompt: '2000-es évekbeli' },
    { id: 'era-2010s', prompt: '2010-es évekbeli' },
    { id: 'era-fresh', prompt: 'friss, 2020 utáni' },
  ]},
  { groupId: 'pace', chips: [
    { id: 'pace-slow', prompt: 'lassú tempójú, hangulatos' },
    { id: 'pace-fast', prompt: 'pörgős, gyors tempójú' },
  ]},
  { groupId: 'setting', chips: [
    { id: 'set-school', prompt: 'iskolai környezetben játszódik' },
    { id: 'set-fantasy', prompt: 'fantasy-világban játszódik' },
    { id: 'set-space', prompt: 'űrben / sci-fi világban játszódik' },
    { id: 'set-historical', prompt: 'történelmi korban játszódik' },
    { id: 'set-city', prompt: 'modern nagyvárosban játszódik' },
  ]},
  { groupId: 'themes', chips: [
    { id: 'th-revenge', prompt: 'bosszú-történet' },
    { id: 'th-sport', prompt: 'sport-téma' },
    { id: 'th-music', prompt: 'zenei téma' },
    { id: 'th-psych', prompt: 'pszichológiai mélységű' },
    { id: 'th-mecha', prompt: 'mecha / óriásrobotok' },
    { id: 'th-isekai', prompt: 'isekai, másik világba kerülés' },
    { id: 'th-timetravel', prompt: 'időutazás-téma' },
    { id: 'th-martial', prompt: 'harcművészet, látványos küzdelmek' },
  ]},
  { groupId: 'demographic', chips: [
    { id: 'demo-shounen', prompt: 'shounen-stílusú' },
    { id: 'demo-seinen', prompt: 'seinen, felnőttesebb hangvétel' },
    { id: 'demo-shoujo', prompt: 'shoujo-stílusú' },
    { id: 'demo-josei', prompt: 'josei, felnőtt női közönségnek' },
  ]},
  { groupId: 'source', chips: [
    { id: 'src-manga', prompt: 'manga-adaptáció' },
    { id: 'src-ln', prompt: 'light novel adaptáció' },
    { id: 'src-original', prompt: 'eredeti (nem adaptáció) anime' },
    { id: 'src-game', prompt: 'videojáték-adaptáció' },
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
