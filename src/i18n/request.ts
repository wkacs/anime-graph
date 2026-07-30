import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/locale'
import en from '../../messages/en.json'
import hu from '../../messages/hu.json'

const MESSAGES: Record<Locale, typeof en> = { en, hu }

// 🔴 SZÁNDÉKOSAN NEM olvas cookie-t vagy fejlécet.
//
// A `cookies()` és a `headers()` dinamikus API: ha a szerver-oldali locale-feloldás
// használná, MINDEN render dinamikussá válna, az ISR-elt katalógus-címoldalak
// (`/anime|manga/[slug]`, revalidate=86400) pedig DYNAMIC_SERVER_USAGE-dzsel 500-at
// dobnának. Az a 133 840 oldal a projekt SEO-magja, azt nem áldozzuk fel.
//
// A `requestLocale` viszont NEM dinamikus API: csak akkor kap értéket, ha valaki
// explicit nyelvvel hív (getTranslations({ locale }) — így megy a serverT az
// API-route-okban). Enélkül a szerver-render nyelve fix `en` — a kanonikus
// SEO-nyelv —, a tényleges nyelvváltás pedig kliens-oldalon történik (IntlProvider).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = (LOCALES as readonly string[]).includes(requested ?? '')
    ? (requested as Locale)
    : DEFAULT_LOCALE
  return { locale, messages: MESSAGES[locale] }
})
