import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE } from '@/lib/locale'
import messages from '../../messages/en.json'

// 🔴 SZÁNDÉKOSAN NEM olvas cookie-t vagy fejlécet.
//
// A `cookies()` és a `headers()` dinamikus API: ha a szerver-oldali locale-feloldás
// használná, MINDEN render dinamikussá válna, az ISR-elt katalógus-címoldalak
// (`/anime|manga/[slug]`, revalidate=86400) pedig DYNAMIC_SERVER_USAGE-dzsel 500-at
// dobnának. Az a 133 840 oldal a projekt SEO-magja, azt nem áldozzuk fel.
//
// Ezért a szerver-oldali alapnyelv fix `en` — ami egyben a kanonikus SEO-nyelv is —,
// a tényleges nyelvváltás pedig kliens-oldalon történik (`IntlProvider`).
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages,
}))
