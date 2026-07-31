// Az üzemeltető adatai EGY helyen. A jogi oldalak innen olvasnak, hogy ne
// kelljen két dokumentumban külön karbantartani.
//
// Az értékek env-ből jönnek (NEXT_PUBLIC_*, hogy build-time beégjenek), így a
// kitöltéshez nem kell kódot módosítani — a Vercel env beállítása elég.
// Szándékosan nincsenek kitalált cégadatok fallbackként — egy kitalált
// székhely vagy adószám a tájékoztatót hamis okirattá tenné.
function operatorField(value: string | undefined, fieldName: string): string {
  const v = value?.trim()
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error(`Hiányzó production üzemeltetői adat: ${fieldName}`)
  }
  return v ? v : `Nincs beállítva (${fieldName})`
}

function optionalOperatorField(value: string | undefined): string {
  return value?.trim() ?? ''
}

export const OPERATOR = {
  name: operatorField(process.env.NEXT_PUBLIC_OPERATOR_NAME, 'üzemeltető neve'),
  /* Opcionális (user-döntés 2026-07-31): cím nélkül a tájékoztató egyszerűen
     nem állít székhelyet — az ügyvédes körben derül ki, kötelező-e megadni. */
  address: optionalOperatorField(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS),
  registration: optionalOperatorField(process.env.NEXT_PUBLIC_OPERATOR_REGISTRATION),
  email: operatorField(process.env.NEXT_PUBLIC_OPERATOR_EMAIL, 'kapcsolattartó e-mail-cím'),
} as const

/** A tájékoztatók utolsó tartalmi módosítása. Kézzel léptetendő. */
export const LEGAL_UPDATED = '2026-07-31'

export const SERVICE_NAME = 'Anime Graph'

/** Adatfeldolgozók és címzettek. A tájékoztató táblázata ebből épül. */
export const PROCESSORS: { name: string; purpose: string; location: string }[] = [
  { name: 'Vercel Inc.', purpose: 'a szolgáltatás üzemeltetése (tárhely)', location: 'EU / USA' },
  { name: 'Neon Inc.', purpose: 'adatbázis-szolgáltatás', location: 'EU / USA' },
  { name: 'Resend', purpose: 'rendszer-levelek kézbesítése (megerősítés, jelszó-visszaállítás)', location: 'USA' },
  { name: 'Sentry (ha be van állítva)', purpose: 'technikai hibariportok fogadása', location: 'EU / USA' },
  {
    name: 'Zhipu AI (open.bigmodel.cn)',
    purpose: 'a véleményeid és ízlés-adataid feldolgozása AI-modellel',
    location: 'Kína',
  },
  { name: 'OpenRouter', purpose: 'tartalék AI-szolgáltató, ha az elsődleges nem elérhető', location: 'USA' },
  { name: 'AniList / MyAnimeList', purpose: 'katalógusadatok és a listaimport (csak ha te indítod)', location: 'USA' },
]
