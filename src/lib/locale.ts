export const LOCALES = ['en', 'hu'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

function asLocale(v: string | null | undefined): Locale | null {
  return v && (LOCALES as readonly string[]).includes(v) ? (v as Locale) : null
}

// Sorrend: bejelentkezett user beállítása > cookie > Accept-Language > angol.
// A user-beállítás azért erős, mert az eszközök között is követni kell.
export function resolveLocale(input: {
  cookie?: string | null
  userLocale?: string | null
  acceptLanguage?: string | null
}): Locale {
  const fromUser = asLocale(input.userLocale)
  if (fromUser) return fromUser
  const fromCookie = asLocale(input.cookie)
  if (fromCookie) return fromCookie
  for (const part of (input.acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0].trim().split('-')[0]
    const hit = asLocale(tag)
    if (hit) return hit
  }
  return DEFAULT_LOCALE
}
