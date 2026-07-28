import { cookies, headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { LOCALE_COOKIE, resolveLocale, type Locale } from './locale'

// 🔴 DINAMIKUS API-t hasznal (cookies/headers), ezert ISR-elt oldal alatt TILOS.
// A katalogus-cimoldalak (`/anime|manga/[slug]`, revalidate=86400) emiatt nem
// hivhatjak — ott a szerver-render nyelve fixen `en` (lasd src/i18n/request.ts).
// Ez a modul a DINAMIKUS feluleteknek szol: API-route-ok es force-dynamic oldalak,
// ahol a valasz amugy is keresenkent kepzodik, tehat a felhasznalo nyelven mehet.
// Az orszem-teszt (isr-db-client.test.ts) tiltja az ISR-modulokban.

export async function requestLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()])
  return resolveLocale({
    cookie: c.get(LOCALE_COOKIE)?.value,
    acceptLanguage: h.get('accept-language'),
  })
}

/** `getTranslations` a keres nyelven — nem a fix `en` szerver-alapertelmezesen. */
export async function serverT(namespace: string) {
  return getTranslations({ locale: await requestLocale(), namespace })
}
