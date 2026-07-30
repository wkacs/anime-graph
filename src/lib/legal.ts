// Az üzemeltető adatai EGY helyen. A jogi oldalak innen olvasnak, hogy ne
// kelljen két dokumentumban külön karbantartani.
//
// Az értékek env-ből jönnek (NEXT_PUBLIC_*, hogy build-time beégjenek), így a
// kitöltéshez nem kell kódot módosítani — a Vercel env beállítása elég.
// Szándékosan nincsenek kitalált cégadatok fallbackként — egy kitalált
// székhely vagy adószám a tájékoztatót hamis okirattá tenné.
function operatorField(value: string | undefined, todo: string): string {
  const v = value?.trim()
  return v ? v : todo
}

export const OPERATOR = {
  name: operatorField(process.env.NEXT_PUBLIC_OPERATOR_NAME, 'TODO: üzemeltető neve (magánszemély vagy cég)'),
  address: operatorField(process.env.NEXT_PUBLIC_OPERATOR_ADDRESS, 'TODO: székhely / levelezési cím'),
  registration: operatorField(process.env.NEXT_PUBLIC_OPERATOR_REGISTRATION, 'TODO: cégjegyzékszám vagy nyilvántartási szám (ha van)'),
  email: operatorField(process.env.NEXT_PUBLIC_OPERATOR_EMAIL, 'TODO: kapcsolattartó e-mail-cím'),
} as const

/** A tájékoztatók utolsó tartalmi módosítása. Kézzel léptetendő. */
export const LEGAL_UPDATED = '2026-07-27'

export const SERVICE_NAME = 'Anime Graph'

/** Adatfeldolgozók és címzettek. A tájékoztató táblázata ebből épül. */
export const PROCESSORS: { name: string; purpose: string; location: string }[] = [
  { name: 'Vercel Inc.', purpose: 'a szolgáltatás üzemeltetése (tárhely)', location: 'EU / USA' },
  { name: 'Neon Inc.', purpose: 'adatbázis-szolgáltatás', location: 'EU / USA' },
  { name: 'Resend', purpose: 'rendszer-levelek kézbesítése (megerősítés, jelszó-visszaállítás)', location: 'USA' },
  {
    name: 'Zhipu AI (open.bigmodel.cn)',
    purpose: 'a véleményeid és ízlés-adataid feldolgozása AI-modellel',
    location: 'Kína',
  },
  { name: 'OpenRouter', purpose: 'tartalék AI-szolgáltató, ha az elsődleges nem elérhető', location: 'USA' },
  { name: 'AniList / MyAnimeList', purpose: 'katalógusadatok és a listaimport (csak ha te indítod)', location: 'USA' },
]
