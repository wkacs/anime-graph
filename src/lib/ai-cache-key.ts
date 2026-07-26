import type { Locale } from './locale'

// Az AI-válaszok nyelvfüggők. A locale nélkül a nyelvváltás után a felhasználó
// a régi nyelvű, cache-elt választ kapná vissza. A korábbi, locale nélküli
// sorok egyszerűen sosem találnak el — nem kell törölni őket, lejárnak.
export function aiCacheKind(base: string, locale: Locale): string {
  return `${base}:${locale}`
}
