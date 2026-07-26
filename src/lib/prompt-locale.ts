import type { Locale } from './locale'

// Egy helyen dől el, milyen nyelven válaszoljon a modell. A prompt-törzsek
// magyarul maradnak (azok a modellnek szólnak, nem a felhasználónak), de a
// KIMENET nyelvét ez az utasítás szabja meg — enélkül az angol felhasználó
// magyar indoklást kapna.
export function languageInstruction(locale: Locale): string {
  return locale === 'hu'
    ? 'A szabad szöveges mezőket (indoklás, összefoglaló, portré, címke) magyarul írd.'
    : 'Write all free-text fields (reasons, summaries, portrait, labels) in English.'
}
